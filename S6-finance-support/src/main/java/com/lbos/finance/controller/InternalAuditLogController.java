package com.lbos.finance.controller;

import com.lbos.finance.dto.AuditLogRequest;
import com.lbos.finance.entity.AuditLog;
import com.lbos.finance.service.AuditLogService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Service-to-service entry point for the other modules to record an audit-trail entry for an
 * administrative action they own (S1 creating a staff account or changing an account's status,
 * S2 approving/rejecting/revoking a partner verification, ...). The audit table lives in S6,
 * but almost every action worth auditing happens somewhere else, so without this endpoint the
 * write path was reachable only by a staff member manually POSTing to /api/audit-logs - which
 * is why the audit log only ever contained the rows DataSeeder inserted directly.
 *
 * Gated by hasRole("SERVICE") like every other /api/v1/internal/** route in this service (see
 * SecurityConfig.internalSecurityFilterChain) - not for browser/end-user use; the staff-facing
 * read surface stays on AuditLogController's JWT-gated /api/audit-logs. Delegates to the same
 * AuditLogServiceImpl.createAuditLog() the public controller uses, so the "write-once,
 * read-many" posture (no update, no delete) holds for service callers too.
 */
@RestController
@RequestMapping("/api/v1/internal")
public class InternalAuditLogController {

    private final AuditLogService auditLogService;

    /**
     * Creates the controller with the service used to persist audit log entries.
     *
     * @param auditLogService service backing audit log creation
     */
    public InternalAuditLogController(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    /**
     * Records an audit log entry on behalf of a calling service.
     *
     * @param request details of the action being audited
     * @return the persisted audit log entry
     */
    @PostMapping("/audit-logs")
    public ResponseEntity<AuditLog> create(@RequestBody AuditLogRequest request) {
        return ResponseEntity.ok(auditLogService.createAuditLog(request));
    }
}
