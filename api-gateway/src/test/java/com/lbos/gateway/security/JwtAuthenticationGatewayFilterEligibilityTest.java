package com.lbos.gateway.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import reactor.core.publisher.Mono;

/** An account made inactive after login must stop getting through even with a still-valid JWT. */
class JwtAuthenticationGatewayFilterEligibilityTest {

    private static final String SECRET = "unit-test-shared-jwt-signing-secret-not-for-production-use-32b";

    private static String tokenFor(String userAccountId, String role) {
        return Jwts.builder()
                .subject(userAccountId)
                .claim("role", role)
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();
    }

    private static JwtAuthenticationGatewayFilter filterWith(AccountEligibility eligibility) {
        JwtProperties properties = new JwtProperties();
        properties.setSecret(SECRET);
        return new JwtAuthenticationGatewayFilter(properties, eligibility);
    }

    private static MockServerWebExchange exchangeFor(String token) {
        return MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/cart").header("Authorization", "Bearer " + token).build());
    }

    @Test
    void inactiveAccountIsRejectedWith401AndNeverReachesDownstream() {
        AtomicBoolean reachedDownstream = new AtomicBoolean(false);
        GatewayFilterChain chain = exchange -> {
            reachedDownstream.set(true);
            return Mono.empty();
        };
        MockServerWebExchange exchange = exchangeFor(tokenFor("acct-1", "CUSTOMER"));

        filterWith(userAccountId -> Mono.just(false)).filter(exchange, chain).block();

        assertEquals(HttpStatus.UNAUTHORIZED, exchange.getResponse().getStatusCode());
        assertFalse(reachedDownstream.get());
    }

    @Test
    void activeAccountIsForwardedWithTrustedIdentityHeaders() {
        AtomicBoolean reachedDownstream = new AtomicBoolean(false);
        GatewayFilterChain chain = exchange -> {
            reachedDownstream.set(true);
            assertEquals("acct-1", exchange.getRequest().getHeaders().getFirst("X-User-Account-Id"));
            return Mono.empty();
        };

        filterWith(userAccountId -> Mono.just(true)).filter(exchangeFor(tokenFor("acct-1", "CUSTOMER")), chain).block();

        assertTrue(reachedDownstream.get());
    }
}
