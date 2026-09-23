package com.lbos.finance.repository;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.lbos.finance.entity.Notification;
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserAccountId(UUID userAccountId);

    /** The newest unread notifications of one user (the bell popup); the page size is the cap. */
    @Query("select n from Notification n where n.userAccountId = :userAccountId and n.read = false order by n.sentAt desc")
    List<Notification> findUnreadNewestFirst(@Param("userAccountId") UUID userAccountId, Pageable pageable);

    @Query("select count(n) from Notification n where n.userAccountId = :userAccountId and n.read = false")
    long countUnread(@Param("userAccountId") UUID userAccountId);

    /** Marks every unread notification of one user as read in one statement; returns how many changed. */
    @Modifying
    @Query("update Notification n set n.read = true where n.userAccountId = :userAccountId and n.read = false")
    int markAllReadFor(@Param("userAccountId") UUID userAccountId);
}
