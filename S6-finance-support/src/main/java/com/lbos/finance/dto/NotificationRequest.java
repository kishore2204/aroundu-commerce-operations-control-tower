package com.lbos.finance.dto;
import java.util.UUID;
public record NotificationRequest(UUID userAccountId, String role, String notificationType, String referenceType, String referenceId, String title, String message) { }
