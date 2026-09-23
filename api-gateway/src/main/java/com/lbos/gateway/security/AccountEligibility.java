package com.lbos.gateway.security;

import reactor.core.publisher.Mono;

/**
 * Answers whether the account behind an already-validated JWT may still use the portal - i.e. the
 * account and every parent in its role hierarchy (e.g. a Location Manager's Operations Manager)
 * are still active. A JWT stays cryptographically valid until it expires, so without this an
 * account deactivated after login would keep working until then.
 */
@FunctionalInterface
public interface AccountEligibility {

    /** Emits {@code false} only when S1 definitively says the account may no longer sign in. */
    Mono<Boolean> isEligible(String userAccountId);
}
