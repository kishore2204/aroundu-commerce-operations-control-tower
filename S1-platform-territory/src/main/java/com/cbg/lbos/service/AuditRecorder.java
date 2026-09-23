package com.cbg.lbos.service;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.cbg.lbos.client.AuditLogClient;

/**
 * Records this service's administrative actions in the platform audit trail owned by S6.
 *
 * Best-effort by design: every failure (S6 down, service discovery not ready, a rejected
 * payload) is logged and swallowed, so creating a staff account or changing an account's
 * status never fails because the audit trail could not be written. Same "a downstream call
 * must not gate the primary action" posture as S2's fan-out to S4/S5 and S4's notification
 * fan-out to S6.
 */
@Component
public class AuditRecorder {

    private static final Logger log = LoggerFactory.getLogger(AuditRecorder.class);

    /** Matches Hibernate's default varchar(255) for S6's unannotated AuditLog String columns. */
    private static final int MAX_VALUE_LENGTH = 255;

    private static final String SOURCE_MODULE = "S1-platform-territory";

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
     * Records an audit entry attributed to the currently authenticated caller, never throwing.
     *
     * @param action the action performed, e.g. {@code USER_ACCOUNT_CREATED}
     * @param oldValues a short description of the state before the change, may be {@code null}
     * @param newValues a short description of the state after the change, may be {@code null}
     */
    public void record(String action, String oldValues, String newValues) {
        record(currentActorAccountId(), action, oldValues, newValues);
    }

    /**
     * Records an audit entry for an explicit actor, never throwing.
     *
     * @param actorAccountId the account that performed the action, may be {@code null}
     * @param action the action performed
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
     * Resolves the acting staff member's account id from the JWT subject, which S1's own
     * JwtService sets to the user account id.
     *
     * @return the authenticated account id, or {@code null} when the call is unauthenticated
     *         (public self-registration, an internal service call, a test)
     */
    public static UUID currentActorAccountId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || authentication.getName() == null) {
            return null;
        }
        try {
            return UUID.fromString(authentication.getName());
        } catch (IllegalArgumentException notAnAccountIdSubject) {
            return null;
        }
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
