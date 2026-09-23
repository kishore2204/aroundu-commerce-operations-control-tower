package com.lbos.finance.repository;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.lbos.finance.entity.AuditLog;
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> { }
