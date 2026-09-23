package com.lbos.finance.entity;
import java.util.UUID;
import java.time.LocalDateTime;
import jakarta.persistence.*;
/** Indexed on user_account_id - findByUserAccountId (the bell dropdown / notifications page, and
 *  used by markRead's ownership check) had no index before. */
@Entity
@Table(name = "notifications", indexes = @Index(name = "idx_notifications_user_account_id", columnList = "user_account_id"))
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long notificationId;
    private UUID userAccountId;
    private String role;
    private String notificationType;
    private String referenceType;
    private String referenceId;
    private String title;
    private String message;
    private Boolean read;
    private LocalDateTime sentAt;
    public Long getNotificationId() { return notificationId; }
    public void setNotificationId(Long notificationId) { this.notificationId = notificationId; }
    public UUID getUserAccountId() { return userAccountId; }
    public void setUserAccountId(UUID userAccountId) { this.userAccountId = userAccountId; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getNotificationType() { return notificationType; }
    public void setNotificationType(String notificationType) { this.notificationType = notificationType; }
    public String getReferenceType() { return referenceType; }
    public void setReferenceType(String referenceType) { this.referenceType = referenceType; }
    public String getReferenceId() { return referenceId; }
    public void setReferenceId(String referenceId) { this.referenceId = referenceId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public Boolean isRead() { return read; }
    public void setRead(Boolean read) { this.read = read; }
    public LocalDateTime getSentAt() { return sentAt; }
    public void setSentAt(LocalDateTime sentAt) { this.sentAt = sentAt; }
}
