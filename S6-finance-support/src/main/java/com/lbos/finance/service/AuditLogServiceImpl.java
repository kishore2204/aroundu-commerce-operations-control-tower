package com.lbos.finance.service;
import java.time.*; import java.util.*;
import org.springframework.stereotype.Service; import org.springframework.transaction.annotation.Transactional;
import com.lbos.finance.dto.*; import com.lbos.finance.entity.*; import com.lbos.finance.exception.*; import com.lbos.finance.integration.client.*; import com.lbos.finance.repository.*;

/** Immutable: no update or delete, ever - see AuditLogService. Previously this service also
 *  injected an unused PaymentTransactionRepository; removed. */
@Service @Transactional
public class AuditLogServiceImpl implements AuditLogService {
    private final AuditLogRepository auditLogRepository;
    private final IdentityServiceClient identityServiceClient;
    public AuditLogServiceImpl(AuditLogRepository auditLogRepository, IdentityServiceClient identityServiceClient) {
        this.auditLogRepository=auditLogRepository; this.identityServiceClient=identityServiceClient;
    }
    @Override public AuditLog createAuditLog(AuditLogRequest request) {
        AuditLog entity = new AuditLog();
        // Audit recording must not disappear simply because the identity service is temporarily
        // unavailable. The JWT-authenticated caller already supplies the account id; the lookup is
        // retained as a best-effort referential check, but an S1 outage no longer drops the audit.
        if (request.userAccountId() != null) {
            try {
                identityServiceClient.getUserAccount(request.userAccountId());
            } catch (RuntimeException identityLookupFailure) {
                // Best-effort validation only. Persist the immutable audit record regardless.
            }
        }
        entity.setUserAccountId(request.userAccountId()); entity.setAction(request.action()); entity.setSourceModule(request.sourceModule()); entity.setOldValues(request.oldValues()); entity.setNewValues(request.newValues()); entity.setIpAddress(request.ipAddress()); entity.setPerformedAt(OffsetDateTime.now());
        return auditLogRepository.save(entity);
    }
    @Override public List<AuditLog> getAllAuditLogs() { return auditLogRepository.findAll(); }
    @Override public AuditLog getAuditLogById(UUID id) { return auditLogRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("AuditLog not found: " + id)); }
}
