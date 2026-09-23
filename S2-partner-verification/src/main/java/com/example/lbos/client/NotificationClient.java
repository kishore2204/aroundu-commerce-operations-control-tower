package com.example.lbos.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.UUID;

/**
 * S2 -> S6 (lbos-finance) notifications, the verification-side counterpart of S4's
 * {@code NotificationClient}: S2 owns the verification decision, but the user-facing
 * "here is what you have to do next" message lives in S6's notification inbox.
 *
 * <p>Used when a Location Manager rejects an INDIVIDUAL document - the subject's owning
 * account has to be told which document was rejected, why, and that a re-upload is needed;
 * without this the rejection is invisible to them (a whole-entry rejection at least surfaces
 * through the subject's own status field, a single-document one does not).
 *
 * <p>S6 gates {@code /api/v1/internal/**} with {@code hasRole("SERVICE")}, so this client is
 * configured with the shared HTTP Basic credential like every other internal client here.
 * Every call site wraps it in try/catch and logs-and-continues, the same best-effort posture
 * as {@link S4OrderClient}/{@link S5FleetClient} usage in VerificationQueueServiceImpl: a
 * notification-delivery failure must never roll back the review decision of record.
 */
@FeignClient(
        name = "lbos-finance",
        contextId = "s2NotificationClient",
        configuration = ServiceBasicAuthFeignConfig.class)
public interface NotificationClient {

    /**
     * Sends a notification-creation request to S6 (lbos-finance).
     *
     * @param request the notification to create
     */
    @PostMapping("/api/v1/internal/notifications")
    void create(@RequestBody NotificationCreateRequest request);

    /**
     * S2-local mirror of S6's {@code NotificationRequest} - S6 accepts the DTO directly (no
     * envelope), same convention as every other internal client in this package. Field names
     * must match S6's record exactly; Jackson silently nulls out anything it cannot map.
     *
     * @param userAccountId the account the notification is addressed to
     * @param role the role of the recipient account
     * @param notificationType the type/category of the notification
     * @param referenceType the type of entity this notification references
     * @param referenceId the id of the referenced entity
     * @param title the notification title
     * @param message the notification body
     */
    record NotificationCreateRequest(
            UUID userAccountId,
            String role,
            String notificationType,
            String referenceType,
            String referenceId,
            String title,
            String message) {
    }
}
