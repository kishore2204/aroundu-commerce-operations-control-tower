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
    void deleteNotification(Long id);
}
