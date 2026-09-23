package com.lbos.finance.dto;
import java.util.UUID;
public record AuditLogRequest(UUID userAccountId, String action, String sourceModule, String oldValues, String newValues, String ipAddress) { }
