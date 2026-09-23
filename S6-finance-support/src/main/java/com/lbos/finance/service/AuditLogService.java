package com.lbos.finance.service;
import java.util.List;
import java.util.UUID;
import com.lbos.finance.dto.AuditLogRequest;
import com.lbos.finance.entity.AuditLog;

/** No update/delete - an audit trail that can be edited or erased after the fact isn't an
 *  audit trail. Entries are write-once, read-many. */
public interface AuditLogService {
    AuditLog createAuditLog(AuditLogRequest request);
    List<AuditLog> getAllAuditLogs();
    AuditLog getAuditLogById(UUID id);
}
