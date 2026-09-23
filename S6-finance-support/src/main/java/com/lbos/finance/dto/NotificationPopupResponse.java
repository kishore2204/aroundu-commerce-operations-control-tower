package com.lbos.finance.dto;

import java.util.List;

import com.lbos.finance.entity.Notification;

/** What the bell popup needs: the newest few UNREAD notifications and the total unread count (for the badge). */
public record NotificationPopupResponse(long unreadCount, List<Notification> items) {}
