/* Notifications (retailer / location / fleet portals) - port of features/retailer/notifications/notifications.component.* */
window.NotificationsPage = {
  tag: 'app-retailer-notifications',
  init() {
    this.state = U.state({ notifications: [], loading: true });
    this.load();
  },
  load() {
    const s = this.state;
    s.loading = true;
    NotificationService.mine().then(
      (list) => {
        s.notifications = list.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
        s.loading = false;
      },
      () => {
        s.loading = false;
      },
    );
  },
  markRead(id) {
    const item = this.state.notifications.find((n) => n.notificationId === id);
    if (!item || item.read) return;
    NotificationService.markRead(item.notificationId).then(
      () => this.load(),
      () => {},
    );
  },
  render() {
    const s = this.state;
    return U.tpl('notifications', [
      s.loading
        ? U.tpl('notifications-1')
        : s.notifications.length === 0
          ? EmptyState({ icon: 'notifications_none', title: 'No notifications' })
          : U.tpl('notifications-2', [
              U.each(s.notifications, (n) =>
                U.tpl('notifications-2-1', [
                  n.notificationId,
                  U.arg(n.notificationId),
                  n.title,
                  U.date(n.sentAt, 'short'),
                  n.message,
                  !n.read ? U.tpl('notifications-2-1-1') : '',
                ]),
              ),
            ]),
    ]);
  },
};
