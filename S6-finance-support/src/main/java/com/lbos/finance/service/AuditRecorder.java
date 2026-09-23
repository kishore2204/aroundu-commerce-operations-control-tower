package com.lbos.finance.service;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.lbos.finance.dto.AuditLogRequest;

/**
 * Best-effort, in-process wrapper for recording an audit-trail entry from S6's own services.
 *
 * Two things this exists for, both of which a direct {@code auditLogService.createAuditLog(...)}
 * call from inside a business method would get wrong:
 * <ul>
 *   <li><b>It must never fail the audited action.</b> Same posture as the notification fan-out in
 *       S4's OrderService and the S5/S4 calls in S2's VerificationQueueServiceImpl - the business
 *       decision is the record of record, and an audit-trail write failure (S1 unreachable for the
 *       actor lookup AuditLogServiceImpl does, a column-length violation, ...) is logged and
 *       swallowed.</li>
 *   <li><b>{@link Propagation#REQUIRES_NEW}.</b> Catching the exception is not enough on its own:
 *       {@code AuditLogServiceImpl} is {@code @Transactional}, so a failure inside the caller's
 *       transaction would mark it rollback-only and the caller's own committed work would be lost
 *       anyway. Recording in its own suspended transaction keeps the failure contained.</li>
 * </ul>
 */
@Component
public class AuditRecorder {

    private static final Logger log = LoggerFactory.getLogger(AuditRecorder.class);

    /** Matches Hibernate's default varchar(255) for AuditLog's unannotated String columns. */
    private static final int MAX_VALUE_LENGTH = 255;

    private static final String SOURCE_MODULE = "S6-finance-support";

    private final AuditLogService auditLogService;

    /**
     * Creates the recorder.
     *
     * @param auditLogService the service used to persist audit log entries
     */
    public AuditRecorder(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    /**
     * Records an audit entry for an action performed in this service, never throwing.
     *
     * @param actorAccountId the account that performed the action, may be {@code null}
     * @param action the action performed, e.g. {@code SUPPORT_TICKET_ESCALATED}
     * @param oldValues a short description of the state before the change, may be {@code null}
     * @param newValues a short description of the state after the change, may be {@code null}
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(UUID actorAccountId, String action, String oldValues, String newValues) {
        try {
            auditLogService.createAuditLog(new AuditLogRequest(
                    actorAccountId, action, SOURCE_MODULE,
                    truncate(oldValues), truncate(newValues), callerIpAddress()));
        } catch (Exception auditWriteFailure) {
            log.warn("Failed to record audit entry {} for actor {}: {}",
                    action, actorAccountId, auditWriteFailure.getMessage(), auditWriteFailure);
        }
    }

    /**
     * Truncates a value to the audit table's column width, so an over-long detail string
     * degrades to a shortened entry rather than losing the entry entirely.
     *
     * @param value the value to truncate, may be {@code null}
     * @return the value, cut to at most {@value #MAX_VALUE_LENGTH} characters
     */
    private static String truncate(String value) {
        if (value == null || value.length() <= MAX_VALUE_LENGTH) {
            return value;
        }
        return value.substring(0, MAX_VALUE_LENGTH);
    }

    /**
     * Best-effort lookup of the IP the current HTTP request came from. Null outside a request
     * (scheduled jobs, tests), which the audit viewer already renders as "-".
     *
     * @return the caller's remote address, or {@code null} if there is no bound request
     */
    static String callerIpAddress() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        if (attributes instanceof ServletRequestAttributes servletAttributes) {
            return servletAttributes.getRequest().getRemoteAddr();
        }
        return null;
    }
}
