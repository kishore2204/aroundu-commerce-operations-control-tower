package com.lbos.finance.service;
import java.util.List;
import java.util.UUID;
import com.lbos.finance.dto.NotificationRequest;
import com.lbos.finance.entity.Notification;
public interface NotificationService {
    Notification createNotification(NotificationRequest request);
    List<Notification> getAllNotifications();
    Notification getNotificationById(Long id);
    Notification updateNotification(Long id, NotificationRequest request);
    Notification markNotificationRead(Long id);
    List<Notification> markAllNotificationsRead(UUID userAccountId);
    List<Notification> getNotificationsByUserAccountId(UUID userAccountId);
    /** The bell popup: the newest {@code POPUP_LIMIT} unread notifications plus the unread total. */
    com.lbos.finance.dto.NotificationPopupResponse getPopup(UUID userAccountId);
    /** "Clear" in the bell popup: marks all of the user's unread notifications as read (history is kept). Returns how many changed. */
    int clearUnread(UUID userAccountId);
    int POPUP_LIMIT = 10;
    void deleteNotification(Long id);
}
