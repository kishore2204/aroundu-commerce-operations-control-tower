package com.lbos.finance.integration.client;
import java.util.UUID;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.*;
import com.lbos.finance.integration.dto.*;

/**
 * S1 protects both /api/v1/operations-managers/** and /api/states/** with a JWT
 * (operations-managers additionally requires SUPER_ADMIN/OPERATIONS_MANAGER), neither of
 * which a service-to-service caller can present. The previous version of this client called
 * those public, JWT-gated endpoints with no credentials at all (and with a wrong path -
 * "/api/operations-managers/{id}" is missing the "/v1/" segment the real controller uses) -
 * every call failed. Both now target /internal/v1/** equivalents added to S1 specifically
 * for this, gated by the shared HTTP Basic credential instead.
 */
public interface OperationsServiceClient {
    OperationsManagerResponse getOperationsManager(UUID operationsManagerId);
    StateResponse getState(UUID stateId);
}

/** S1's internal response shapes use different field names (id/status vs this client's
 *  operationsManagerId/assignmentStatus, stateId/active vs id/isActive) - mapped below rather
 *  than reused directly, since trusting identical field names across two independently-evolving
 *  services is exactly what silently broke the identity-service client the same way. */
record RawOperationsManager(UUID operationsManagerId, UUID userAccountId, UUID cityId, String status, boolean canOperate) {
}

record RawState(UUID stateId, String stateName, String countryCode, Boolean active) {
}

@FeignClient(name = "lbos-platform", contextId = "operationsServiceRawClient", configuration = ServiceBasicAuthFeignConfig.class)
interface RawOperationsServiceClient {
    @GetMapping("/internal/v1/operations-managers/{operationsManagerId}")
    RawOperationsManager getOperationsManager(@PathVariable("operationsManagerId") UUID operationsManagerId);

    @GetMapping("/internal/v1/states/{stateId}")
    RawState getState(@PathVariable("stateId") UUID stateId);
}

@Component
class OperationsServiceClientImpl implements OperationsServiceClient {

    private final RawOperationsServiceClient delegate;

    OperationsServiceClientImpl(RawOperationsServiceClient delegate) {
        this.delegate = delegate;
    }

    @Override
    public OperationsManagerResponse getOperationsManager(UUID operationsManagerId) {
        RawOperationsManager raw = delegate.getOperationsManager(operationsManagerId);
        return new OperationsManagerResponse(raw.operationsManagerId(), raw.userAccountId(), raw.cityId(), raw.status());
    }

    @Override
    public StateResponse getState(UUID stateId) {
        RawState raw = delegate.getState(stateId);
        return new StateResponse(raw.stateId(), raw.stateName(), raw.countryCode(), raw.active());
    }
}
