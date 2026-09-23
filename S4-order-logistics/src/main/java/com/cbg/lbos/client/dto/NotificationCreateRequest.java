package com.cbg.lbos.client.dto;

import java.util.UUID;

/**
 * S4-local mirror of S6's NotificationRequest - S6 returns/accepts the DTO directly
 * (no envelope), same convention as every other internal client in this class.
 */
public record NotificationCreateRequest(
        UUID userAccountId,
        String role,
        String notificationType,
        String referenceType,
        String referenceId,
        String title,
        String message) {
}
