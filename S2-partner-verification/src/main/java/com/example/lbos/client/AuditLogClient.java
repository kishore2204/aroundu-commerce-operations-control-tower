package com.example.lbos.client;

import java.util.UUID;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

/**
 * Records platform audit-trail entries in S6 (lbos-finance), which owns the {@code audit_log}
 * table. S6 gates {@code /api/v1/internal/**} with {@code hasRole("SERVICE")}, so this client
 * carries the shared HTTP Basic credential, the same as {@link S4OrderClient} and
 * {@link S5FleetClient} here.
 *
 * Every call site goes through {@link com.example.lbos.service.AuditRecorder}, which logs and
 * continues on failure - the verification decision is the record of record and must stand even
 * if the audit-trail write does not, exactly like the existing S4/S5 fan-outs in
 * VerificationQueueServiceImpl.
 */
@FeignClient(name = "lbos-finance", contextId = "partnerAuditLogClient", configuration = ServiceBasicAuthFeignConfig.class)
public interface AuditLogClient {

    /**
     * Records an audit log entry in S6.
     *
     * @param request the entry to record
     */
    @PostMapping("/api/v1/internal/audit-logs")
    void record(@RequestBody AuditLogCreateRequest request);

    /**
     * Payload matching S6's {@code AuditLogRequest} record.
     *
     * @param userAccountId the account that performed the audited action
     * @param action the action that was performed
     * @param sourceModule the module the action originated from
     * @param oldValues a short snapshot of the values before the change
     * @param newValues a short snapshot of the values after the change
     * @param ipAddress the IP address the request originated from
     */
    record AuditLogCreateRequest(UUID userAccountId, String action, String sourceModule,
            String oldValues, String newValues, String ipAddress) {
    }
}
