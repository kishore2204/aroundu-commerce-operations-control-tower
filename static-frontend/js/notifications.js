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
    NotificationService.mine().then((list) => { s.notifications = list.sort((a, b) => b.sentAt.localeCompare(a.sentAt)); s.loading = false; }, () => { s.loading = false; });
  },
  markRead(id) {
    const item = this.state.notifications.find((n) => n.notificationId === id);
    if (!item || item.read) return;
    NotificationService.markRead(item.notificationId).then(() => this.load(), () => {});
  },
  render() {
    const html = U.html;
    const s = this.state;
    return html`<div class="mb-5 flex items-center justify-between"><div><h1 class="text-2xl font-extrabold text-slate-900">Notifications</h1><p class="text-sm text-slate-500">Store and verification updates for your account.</p></div><button type="button" class="btn-outline" onclick="Page.load()">Refresh</button></div>
${s.loading ? html`<div class="flex justify-center py-10"><span class="spinner"></span></div>` : s.notifications.length === 0 ? EmptyState({ icon: 'notifications_none', title: 'No notifications' }) : html`<div class="card"><ul class="divide-y divide-slate-100">${U.each(s.notifications, (n) => html`<li class="py-4" data-key="${n.notificationId}"><button type="button" class="w-full text-left" onclick="Page.markRead(${U.arg(n.notificationId)})"><div class="flex justify-between gap-3"><span class="font-bold text-slate-900">${n.title}</span><span class="text-xs text-slate-400">${U.date(n.sentAt, 'short')}</span></div><p class="mt-1 text-sm text-slate-600">${n.message}</p>${!n.read ? html`<span class="mt-2 inline-block text-xs font-bold text-zepto-600">Mark as read</span>` : ''}</button></li>`)}</ul></div>`}`;
  },
};
