package com.lbos.finance.controller;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;
import com.lbos.finance.dto.AuditLogRequest; import com.lbos.finance.entity.AuditLog; import com.lbos.finance.service.AuditLogService;

/** No PUT/DELETE - the audit trail is write-once, read-many. See AuditLogService. */
@RestController @RequestMapping("/api/audit-logs")
public class AuditLogController {
    private final AuditLogService auditLogService;
    public AuditLogController(AuditLogService auditLogService) { this.auditLogService = auditLogService; }
    @PostMapping public AuditLog createAuditLog(@RequestBody AuditLogRequest request) { return auditLogService.createAuditLog(request); }
    @GetMapping public List<AuditLog> getAllAuditLogs() { return auditLogService.getAllAuditLogs(); }
    @GetMapping("/{id}") public AuditLog getAuditLogById(@PathVariable UUID id) { return auditLogService.getAuditLogById(id); }
}
