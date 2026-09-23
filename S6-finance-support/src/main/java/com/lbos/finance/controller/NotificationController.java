package com.lbos.finance.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.lbos.finance.dto.NotificationPopupResponse;
import com.lbos.finance.dto.NotificationRequest;
import com.lbos.finance.entity.Notification;
import com.lbos.finance.service.NotificationService;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @PostMapping
    public Notification createNotification(@RequestBody NotificationRequest request) {
        return notificationService.createNotification(request);
    }

    @GetMapping
    public List<Notification> getAllNotifications() {
        return notificationService.getAllNotifications();
    }

    /**
     * Returns only the authenticated user's own notifications, using the JWT subject
     * (userAccountId) to filter server-side.
     */
    @GetMapping("/mine")
    public List<Notification> getMyNotifications(Authentication authentication) {
        UUID userAccountId = resolveUserAccountId(authentication);
        return notificationService.getNotificationsByUserAccountId(userAccountId);
    }

    /** The bell popup: only the newest unread notifications (capped) and the unread count - never the whole history. */
    @GetMapping("/mine/popup")
    public NotificationPopupResponse getMyNotificationPopup(Authentication authentication) {
        return notificationService.getPopup(resolveUserAccountId(authentication));
    }

    /** "Clear" in the bell popup: marks the caller's own unread notifications as read (scoped by the JWT, not a parameter). */
    @PatchMapping("/mine/clear")
    public java.util.Map<String, Integer> clearMyNotifications(Authentication authentication) {
        return java.util.Map.of("cleared", notificationService.clearUnread(resolveUserAccountId(authentication)));
    }

    @GetMapping("/{id}")
    public Notification getNotificationById(@PathVariable Long id) {
        return notificationService.getNotificationById(id);
    }

    @PutMapping("/{id}")
    public Notification updateNotification(@PathVariable Long id, @RequestBody NotificationRequest request) {
        return notificationService.updateNotification(id, request);
    }

    @PatchMapping("/{id}/read")
    public Notification markNotificationRead(@PathVariable Long id) {
        return notificationService.markNotificationRead(id);
    }

    @PatchMapping("/read-all")
    public List<Notification> markAllNotificationsRead(@RequestParam UUID userAccountId) {
        return notificationService.markAllNotificationsRead(userAccountId);
    }

    @DeleteMapping("/{id}")
    public void deleteNotification(@PathVariable Long id) {
        notificationService.deleteNotification(id);
    }

    private UUID resolveUserAccountId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new IllegalStateException("No authenticated user on this request");
        }
        try {
            return UUID.fromString(authentication.getName());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("Authenticated subject is not a valid user account id");
        }
    }
}
