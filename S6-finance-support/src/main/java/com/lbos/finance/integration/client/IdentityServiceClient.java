package com.lbos.finance.integration.client;

import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import com.lbos.finance.integration.dto.UserAccountResponse;

/**
 * S1 protects every /api/** endpoint with a JWT (operations-manager-only for
 * /api/user-accounts/**), which a service-to-service caller can never present. The
 * previous version of this client called that public, JWT-gated endpoint with no
 * credentials at all - every call failed. S1's actual service-to-service surface is
 * /internal/v1/user-accounts/{id}, gated by a shared HTTP Basic credential instead
 * (see ServiceBasicAuthFeignConfig) - this client now targets that.
 */
@FeignClient(name = "lbos-platform", contextId = "financeUserAccountClient", configuration = ServiceBasicAuthFeignConfig.class)
interface RawIdentityServiceClient {
    @GetMapping("/internal/v1/user-accounts/{id}")
    RawUserAccount getUserAccount(@PathVariable("id") UUID id);
}

/** Mirrors S1's actual UserAccountResponseDto field names (id, not userAccountId) -
 *  the previous DTO shape mismatch would have silently deserialized every field as
 *  null even once the path/auth were fixed. */
record RawUserAccount(UUID id, String email, String phoneNumber, String firstName, String lastName, String role, String accountStatus) {
}

@Component
public class IdentityServiceClient {

    private final RawIdentityServiceClient delegate;

    public IdentityServiceClient(RawIdentityServiceClient delegate) {
        this.delegate = delegate;
    }

    public UserAccountResponse getUserAccount(UUID userAccountId) {
        RawUserAccount raw = delegate.getUserAccount(userAccountId);
        return new UserAccountResponse(raw.id(), raw.email(), raw.phoneNumber(), raw.firstName(), raw.lastName(), raw.role(), raw.accountStatus());
    }
}
