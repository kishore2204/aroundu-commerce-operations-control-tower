/* Portal sidebar (layout/*-shell) - brand, navigation, the collapse toggle and log out; a drawer below the lg breakpoint. */
(function () {
  'use strict';

  const html = U.html;

  Object.assign(PortalShell, {
    toggleSidebar() { this.state.sidebarOpen = !this.state.sidebarOpen; },
    closeSidebar() { this.state.sidebarOpen = false; },
    toggleCollapsed() {
      const next = !this.state.collapsed;
      this.state.collapsed = next;
      localStorage.setItem('aroundu.sidebarCollapsed', String(next));
    },
    renderSidebar() {
      const c = this.config;
      const s = this.state;
      const collapsed = s.collapsed;
      return html`
  ${s.sidebarOpen ? html`<div class="fixed inset-0 bg-black/40 z-30 lg:hidden" onclick="PortalShell.closeSidebar()"></div>` : ''}

  <aside class="${U.cls('fixed inset-y-0 left-0 z-40 bg-zepto-800 text-zepto-100 flex flex-col transform transition-all duration-200 lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen', { '-translate-x-full': !s.sidebarOpen, 'translate-x-0': s.sidebarOpen, 'w-64': !collapsed, 'w-[72px]': collapsed })}">
    <div class="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
      <span class="brandmark !h-9 !w-9 !rotate-0 !text-base">A</span>
      ${!collapsed ? html`
        <span class="text-white font-bold text-lg">AroundU</span>
        <span class="ml-auto text-[10px] font-semibold uppercase tracking-wide bg-white/10 text-zepto-100 px-2 py-0.5 rounded-full">${c.badge}</span>` : ''}
    </div>

    <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      ${U.each(c.navItems, (item) => html`
        <a href="${Nav.href(item.path)}"
          class="${U.cls('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zepto-100 hover:bg-white/10 transition-colors', { 'justify-center': collapsed, 'bg-gradient-to-r from-zepto-600 to-violet-600 text-white shadow-glow': Nav.isActive(item.path) })}"
          title="${collapsed ? item.label : ''}" onclick="PortalShell.closeSidebar()">
          <i class="fa-solid ${item.icon} w-5 text-center"></i>
          ${!collapsed ? html`<span>${item.label}</span>` : ''}
        </a>`)}
    </nav>

    <div class="px-3 py-2 border-t border-white/10">
      <button type="button" onclick="PortalShell.toggleCollapsed()"
        class="${U.cls('hidden lg:flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-zepto-100 hover:bg-white/10 transition-colors', { 'justify-center': collapsed })}" aria-label="Toggle sidebar width">
        <i class="${U.cls('fa-solid', { 'fa-angles-left': !collapsed, 'fa-angles-right': collapsed })}"></i>
        ${!collapsed ? html`<span>Collapse</span>` : ''}
      </button>
    </div>

    <div class="px-3 py-4 border-t border-white/10">
      <button type="button" onclick="PortalShell.logout()"
        class="${U.cls('flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-zepto-100 hover:bg-white/10 transition-colors', { 'justify-center': collapsed })}" title="${collapsed ? 'Log out' : ''}">
        <i class="fa-solid fa-right-from-bracket w-5 text-center"></i>
        ${!collapsed ? html`<span>Log out</span>` : ''}
      </button>
    </div>
  </aside>`;
    },
  });
})();
