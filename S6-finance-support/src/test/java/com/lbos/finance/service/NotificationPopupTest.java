package com.lbos.finance.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import com.lbos.finance.entity.Notification;
import com.lbos.finance.repository.NotificationRepository;

/** The bell popup reads only the newest few UNREAD notifications (never the whole history) and can be cleared in one statement. */
@ExtendWith(MockitoExtension.class)
class NotificationPopupTest {

    @Mock private NotificationRepository notificationRepository;
    @InjectMocks private NotificationServiceImpl service;

    @Test
    void thePopupAsksForAtMostTenUnreadNotificationsAndReportsTheTotalUnreadCount() {
        UUID user = UUID.randomUUID();
        Notification newest = new Notification();
        newest.setTitle("Order placed");
        when(notificationRepository.countUnread(user)).thenReturn(50L);
        when(notificationRepository.findUnreadNewestFirst(eq(user), any(Pageable.class))).thenReturn(List.of(newest));

        var popup = service.getPopup(user);

        assertEquals(50L, popup.unreadCount());
        assertEquals(1, popup.items().size());
        ArgumentCaptor<Pageable> page = ArgumentCaptor.forClass(Pageable.class);
        verify(notificationRepository).findUnreadNewestFirst(eq(user), page.capture());
        assertEquals(NotificationService.POPUP_LIMIT, page.getValue().getPageSize());
        assertEquals(0, page.getValue().getPageNumber());
    }

    @Test
    void clearingMarksOnlyThatUsersUnreadNotificationsReadWithOneStatement() {
        UUID user = UUID.randomUUID();
        when(notificationRepository.markAllReadFor(user)).thenReturn(7);

        assertEquals(7, service.clearUnread(user));

        verify(notificationRepository).markAllReadFor(user);
    }
}
