/* Portal top header (layout/*-shell) - menu button, portal title, territory chip and the account menu. */
(function () {
  'use strict';

  const html = U.html;

  Object.assign(PortalShell, {
    toggleAccountMenu() { this.state.accountMenuOpen = !this.state.accountMenuOpen; },
    logout() {
      AuthService.logout();
      Nav.go('/login');
    },
    renderHeader() {
      const c = this.config;
      const s = this.state;
      return html`
    <header class="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl flex items-center gap-3 px-4 sm:px-6 py-3">
      <button type="button" class="btn-icon lg:hidden" onclick="PortalShell.toggleSidebar()" aria-label="Toggle menu">
        <i class="fa-solid fa-bars"></i>
      </button>
      <span class="font-semibold text-slate-800">${c.title}</span>
      ${c.loadTerritory && s.myTerritory ? html`
        <span class="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          <i class="fa-solid fa-map-location-dot text-zepto-600"></i> ${s.myTerritory}
        </span>` : ''}
      <span class="flex-1"></span>

      <div class="relative">
        <button type="button" class="btn-icon" onclick="PortalShell.toggleAccountMenu()" aria-label="Account">
          <i class="fa-solid fa-circle-user text-xl text-zepto-600"></i>
        </button>
        ${s.accountMenuOpen ? html`
          <div class="dropdown-panel absolute right-0 mt-2 w-56 p-1.5 z-30">
            <div class="px-3 py-2 text-xs text-slate-500 truncate">${AuthService.email()}</div>
            ${c.verificationLink ? html`
              <a href="${Nav.href(c.verificationLink)}" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-zepto-50" onclick="PortalShell.state.accountMenuOpen = false">
                <i class="fa-solid fa-shield-halved w-4 text-center"></i>
                <span>Verification status</span>
              </a>` : ''}
            <button type="button" onclick="PortalShell.logout()" class="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-zepto-50">
              <i class="fa-solid fa-right-from-bracket w-4 text-center"></i>
              <span>Log out</span>
            </button>
          </div>` : ''}
      </div>
    </header>`;
    },
  });
})();
