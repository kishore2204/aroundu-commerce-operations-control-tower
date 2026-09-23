package com.lbos.finance.repository;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.lbos.finance.entity.SupportTicketMessage;
public interface SupportTicketMessageRepository extends JpaRepository<SupportTicketMessage, UUID> {
    List<SupportTicketMessage> findByCustomerTicketIdOrderBySentAtAsc(UUID customerTicketId);
}
