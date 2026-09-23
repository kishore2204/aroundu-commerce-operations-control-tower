package com.cbg.lbos.client;

import java.util.UUID;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

/**
 * Records platform audit-trail entries in S6 (lbos-finance), which owns the {@code audit_log}
 * table. S6 gates {@code /api/v1/internal/**} with {@code hasRole("SERVICE")}, so this client
 * carries the shared HTTP Basic credential, the same as {@link S2PartnerClient} here and S4's
 * NotificationClient.
 *
 * Every call site goes through {@link com.cbg.lbos.service.AuditRecorder}, which logs and
 * continues on failure - an audit-trail write must never block the administrative action it
 * describes, matching the best-effort posture of every other outbound call in this codebase.
 */
@FeignClient(name = "lbos-finance", contextId = "platformAuditLogClient", configuration = ServiceBasicAuthFeignConfig.class)
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
