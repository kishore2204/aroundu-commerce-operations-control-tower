package com.lbos.finance.controller;

import com.lbos.finance.dto.NotificationRequest;
import com.lbos.finance.entity.Notification;
import com.lbos.finance.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Service-to-service entry point for other services to raise a notification on a user's
 * behalf (e.g. S4 notifying a retailer of a new order, or a customer of an accept/reject/
 * timeout outcome). Gated by hasRole("SERVICE") like every other /api/v1/internal/** route
 * in this service (see SecurityConfig.internalSecurityFilterChain) - not for browser/
 * end-user use. Delegates to the existing NotificationServiceImpl.createNotification(),
 * which already validates the recipient account is ACTIVE.
 */
@RestController
@RequestMapping("/api/v1/internal")
public class InternalNotificationController {

    private final NotificationService notificationService;

    public InternalNotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @PostMapping("/notifications")
    public ResponseEntity<Notification> create(@RequestBody NotificationRequest request) {
        return ResponseEntity.ok(notificationService.createNotification(request));
    }
}
