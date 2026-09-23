package com.lbos.finance.repository;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.lbos.finance.entity.Notification;
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserAccountId(UUID userAccountId);
}
