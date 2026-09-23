package com.lbos.gateway.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Set;

import javax.crypto.SecretKey;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.server.ServerWebExchange;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import reactor.core.publisher.Mono;

/**
 * Single authentication AND authorization choke point for the whole platform. Validates the
 * JWT issued by S1's {@code AuthController} (same signing secret, configured via
 * {@code app.jwt.secret} on both services), checks the token's role against
 * {@link RouteAuthorizationRules} for the requested path, and - on success - replaces any
 * client-supplied {@code X-User-Account-Id}/{@code X-User-Role} headers with trusted values
 * derived from the token before forwarding the request downstream. Downstream services never
 * see or need to validate the JWT itself - they trust these two headers, the same pattern S3
 * already used for its own {@code X-User-Account-Id} header before this Gateway existed.
 */
@Component
@EnableConfigurationProperties(JwtProperties.class)
public class JwtAuthenticationGatewayFilter implements GlobalFilter, Ordered {

    private static final Set<String> PUBLIC_PATH_PREFIXES = Set.of(
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/forgot-password",
            "/api/v1/auth/reset-password",
            "/actuator");

    /*
     * S3 marks these GET routes permitAll() in its own SecurityConfig (catalogue/category
     * browsing, public review reads) - genuinely anonymous, no identity needed downstream
     * (product/category search filters by status/params only, never by caller identity). The
     * Gateway previously required a JWT for every path outside PUBLIC_PATH_PREFIXES regardless
     * of method, so an anonymous GET here 401'd before ever reaching S3 - confirmed live, not a
     * hypothetical. Method-scoped (not folded into PUBLIC_PATH_PREFIXES) because non-GET verbs
     * on these same prefixes still require RETAILER/SUPER_ADMIN per S3's own SecurityConfig.
     */
    private static final Set<String> PUBLIC_GET_PATH_PREFIXES = Set.of(
            "/api/v1/products",
            "/api/v1/product-categories",
            "/api/v1/reviews");

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationGatewayFilter.class);

    private final SecretKey signingKey;
    private final AccountEligibility accountEligibility;
    private final AntPathMatcher pathMatcher = new AntPathMatcher();

    /** Without an eligibility source, a valid token is all that is checked (unit tests). */
    public JwtAuthenticationGatewayFilter(JwtProperties properties) {
        this(properties, userAccountId -> Mono.just(true));
    }

    @Autowired
    public JwtAuthenticationGatewayFilter(JwtProperties properties, AccountEligibility accountEligibility) {
        this.accountEligibility = accountEligibility;
        this.signingKey = Keys.hmacShaKeyFor(properties.getSecret().getBytes(StandardCharsets.UTF_8));
        log.info("JWT signing key fingerprint: {} - this MUST match S1's fingerprint exactly "
                + "(same app.jwt.secret on both). The Gateway is the sole JWT validation point "
                + "for the whole platform: if this drifts from S1's, every authenticated request "
                + "401s immediately after a successful login, and the frontend shows "
                + "'session expired' for every user.", fingerprintOf(properties.getSecret()));
    }

    /** SHA-256 of the secret, first 8 hex chars only - identifies a mismatch without ever
     * logging the actual secret value. */
    private static String fingerprintOf(String secret) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 4);
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    @Override
    public int getOrder() {
        return -1;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String requestPath = exchange.getRequest().getURI().getPath();
        if (isPublic(requestPath) || isPublicGet(requestPath, exchange.getRequest().getMethod())) {
            return chain.filter(exchange);
        }

        String authorizationHeader = exchange.getRequest().getHeaders().getFirst("Authorization");
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            return respondWithStatus(exchange, HttpStatus.UNAUTHORIZED);
        }

        Claims tokenClaims;
        try {
            tokenClaims = Jwts.parser().verifyWith(signingKey).build()
                    .parseSignedClaims(authorizationHeader.substring(7)).getPayload();
        } catch (JwtException | IllegalArgumentException tokenException) {
            return respondWithStatus(exchange, HttpStatus.UNAUTHORIZED);
        }

        String userAccountId = tokenClaims.getSubject();
        String userRole = tokenClaims.get("role", String.class);

        if (!isRoleAuthorizedForPath(requestPath, userRole)) {
            return respondWithStatus(exchange, HttpStatus.FORBIDDEN);
        }

        ServerHttpRequest requestWithTrustedIdentity = exchange.getRequest().mutate()
                .headers(headers -> {
                    headers.remove("X-User-Account-Id");
                    headers.remove("X-User-Role");
                    headers.set("X-User-Account-Id", userAccountId);
                    headers.set("X-User-Role", userRole);
                })
                .build();

        // A still-valid JWT is not enough: the account (and every parent in its role hierarchy, e.g.
        // a Location Manager's Operations Manager) must still be active, otherwise deactivating an
        // account would not take effect until its token expires. Answered by S1, cached briefly.
        return accountEligibility.isEligible(userAccountId).flatMap(eligible -> eligible
                ? chain.filter(exchange.mutate().request(requestWithTrustedIdentity).build())
                : respondWithStatus(exchange, HttpStatus.UNAUTHORIZED));
    }

    private boolean isPublic(String requestPath) {
        return PUBLIC_PATH_PREFIXES.stream().anyMatch(requestPath::startsWith);
    }

    private boolean isPublicGet(String requestPath, org.springframework.http.HttpMethod method) {
        return org.springframework.http.HttpMethod.GET.equals(method)
                && PUBLIC_GET_PATH_PREFIXES.stream().anyMatch(requestPath::startsWith);
    }

    /** Fail-closed: every protected route must be explicitly present in the authorization table.
     * A missing or null role never grants access. */
    boolean isRoleAuthorizedForPath(String requestPath, String userRole) {
        for (RouteAuthorizationRule rule : RouteAuthorizationRules.RULES) {
            if (matchesRuleIncludingBareCollectionPath(rule.pathPattern(), requestPath)) {
                return userRole != null && rule.allowedRoles().contains(userRole);
            }
        }
        return false;
    }

    /** {@code AntPathMatcher} does not treat "/api/states/**" as matching the bare collection
     * path "/api/states" (no trailing segment), unlike the {@code PathPattern} matcher the
     * Gateway's own routing uses for the identical predicates in application.yml - so a rule
     * written only as "/foo/**" would silently fail open on "/foo" itself. Matching against
     * both the pattern and its "/**"-stripped prefix keeps this check consistent with what
     * actually gets routed. */
    private boolean matchesRuleIncludingBareCollectionPath(String pathPattern, String requestPath) {
        if (pathMatcher.match(pathPattern, requestPath)) {
            return true;
        }
        if (pathPattern.endsWith("/**")) {
            String collectionRootPath = pathPattern.substring(0, pathPattern.length() - "/**".length());
            return requestPath.equals(collectionRootPath);
        }
        return false;
    }

    private Mono<Void> respondWithStatus(ServerWebExchange exchange, HttpStatus status) {
        exchange.getResponse().setStatusCode(status);
        return exchange.getResponse().setComplete();
    }
}
