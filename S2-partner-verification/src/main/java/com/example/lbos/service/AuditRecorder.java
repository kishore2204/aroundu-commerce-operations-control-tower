package com.example.lbos.service;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.example.lbos.client.AuditLogClient;

/**
 * Records this service's verification decisions in the platform audit trail owned by S6.
 *
 * Best-effort by design: every failure (S6 down, service discovery not ready, a rejected
 * payload) is logged and swallowed, so a Location Manager's approve/reject and an Operations
 * Manager's revoke never fail because the audit trail could not be written - the same posture
 * as the existing cancelRetailerOrdersInS4BestEffort/dispatchToLocationManager fan-outs in
 * VerificationQueueServiceImpl.
 */
@Component
public class AuditRecorder {

    private static final Logger log = LoggerFactory.getLogger(AuditRecorder.class);

    /** Matches Hibernate's default varchar(255) for S6's unannotated AuditLog String columns. */
    private static final int MAX_VALUE_LENGTH = 255;

    private static final String SOURCE_MODULE = "S2-partner-verification";

    private final AuditLogClient auditLogClient;

    /**
     * Creates the recorder.
     *
     * @param auditLogClient the client used to write entries to S6's audit trail
     */
    public AuditRecorder(AuditLogClient auditLogClient) {
        this.auditLogClient = auditLogClient;
    }

    /**
     * Records an audit entry, never throwing.
     *
     * @param actorAccountId the account that performed the action, may be {@code null}
     * @param action the action performed, e.g. {@code VERIFICATION_APPROVED}
     * @param oldValues a short description of the state before the change, may be {@code null}
     * @param newValues a short description of the state after the change, may be {@code null}
     */
    public void record(UUID actorAccountId, String action, String oldValues, String newValues) {
        try {
            auditLogClient.record(new AuditLogClient.AuditLogCreateRequest(
                    actorAccountId, action, SOURCE_MODULE,
                    truncate(oldValues), truncate(newValues), callerIpAddress()));
        } catch (Exception auditWriteFailure) {
            log.warn("Failed to record audit entry {} for actor {}: {}",
                    action, actorAccountId, auditWriteFailure.getMessage(), auditWriteFailure);
        }
    }

    /**
     * Records an audit entry described in terms of the entity it affected, never throwing.
     *
     * S6's {@code audit_log} has no entityType/entityId columns of its own (only
     * {@code old_values}/{@code new_values}), so the subject and the detail are folded into the
     * new-values snapshot rather than dropped - this overload exists so a call site that thinks
     * in "what did this change" terms does not have to do that flattening itself.
     *
     * @param actorAccountId the account that performed the action, may be {@code null}
     * @param action the action performed, e.g. {@code VERIFICATION_DOCUMENT_REJECTED}
     * @param entityType the type of entity the action affected
     * @param entityId the id of the entity the action affected
     * @param details a short human-readable description of what changed and why
     */
    public void record(UUID actorAccountId, String action, String entityType, String entityId, String details) {
        record(actorAccountId, action, null,
                "entity=" + entityType + " " + entityId + (details != null ? "; " + details : ""));
    }

    /**
     * Truncates a value to S6's audit column width, so an over-long detail string degrades to a
     * shortened entry rather than losing the entry entirely.
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
     * Best-effort lookup of the IP the current HTTP request came from.
     *
     * @return the caller's remote address, or {@code null} if there is no bound request
     */
    private static String callerIpAddress() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        if (attributes instanceof ServletRequestAttributes servletAttributes) {
            return servletAttributes.getRequest().getRemoteAddr();
        }
        return null;
    }
}
