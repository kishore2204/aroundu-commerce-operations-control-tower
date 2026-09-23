package com.lbos.gateway.security;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import reactor.core.publisher.Mono;

/**
 * Asks S1 (lbos-platform, {@code /internal/v1/user-accounts/{id}/login-eligibility}) whether an
 * account is still allowed in, and remembers the answer for a short TTL so this costs one S1 call
 * per user per TTL rather than one per request.
 *
 * <p>Fails open: if S1 cannot answer (down, slow, unexpected response) the request proceeds
 * exactly as before this check existed - an S1 outage must not lock everyone out of the platform,
 * the same posture S1 takes towards S2/S5 in its own login checks. Failures are never cached, so
 * the very next request asks again.
 */
@Component
public class PlatformAccountEligibility implements AccountEligibility {

    private static final Logger log = LoggerFactory.getLogger(PlatformAccountEligibility.class);
    private static final Duration LOOKUP_TIMEOUT = Duration.ofSeconds(2);
    private static final int MAX_CACHED_ACCOUNTS = 10_000;

    private record Verdict(boolean eligible, long expiresAtNanos) {
    }

    /** The plain-status shape S1 returns; unknown fields (reason) are ignored. */
    private record EligibilityResponse(Boolean eligible) {
    }

    private final WebClient platformClient;
    private final long ttlNanos;
    private final Map<String, Verdict> verdicts = new ConcurrentHashMap<>();

    public PlatformAccountEligibility(
            @Qualifier("loadBalancedWebClientBuilder") WebClient.Builder loadBalancedBuilder,
            @Value("${app.security.service.password:service123}") String servicePassword,
            @Value("${app.security.account-eligibility-ttl-seconds:30}") long ttlSeconds) {
        String credentials = Base64.getEncoder()
                .encodeToString(("lbos-service:" + servicePassword).getBytes(StandardCharsets.UTF_8));
        this.platformClient = loadBalancedBuilder.clone()
                .baseUrl("http://lbos-platform")
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Basic " + credentials)
                .build();
        this.ttlNanos = Duration.ofSeconds(ttlSeconds).toNanos();
    }

    @Override
    public Mono<Boolean> isEligible(String userAccountId) {
        if (userAccountId == null || ttlNanos <= 0) {
            return Mono.just(true);
        }
        Verdict cached = verdicts.get(userAccountId);
        if (cached != null && System.nanoTime() < cached.expiresAtNanos()) {
            return Mono.just(cached.eligible());
        }
        return platformClient.get()
                .uri("/internal/v1/user-accounts/{id}/login-eligibility", userAccountId)
                .retrieve()
                .bodyToMono(EligibilityResponse.class)
                .timeout(LOOKUP_TIMEOUT)
                .map(response -> response.eligible() == null || response.eligible())
                .doOnNext(eligible -> remember(userAccountId, eligible))
                .onErrorResume(lookupFailure -> {
                    log.debug("Account eligibility lookup failed for {} - allowing request: {}", userAccountId, lookupFailure.toString());
                    return Mono.just(true);
                });
    }

    private void remember(String userAccountId, boolean eligible) {
        if (verdicts.size() >= MAX_CACHED_ACCOUNTS) {
            verdicts.clear();
        }
        verdicts.put(userAccountId, new Verdict(eligible, System.nanoTime() + ttlNanos));
    }
}
