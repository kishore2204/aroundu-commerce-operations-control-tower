/* Portal top header (layout/*-shell) - menu button, portal title, territory chip and the account menu. */
(function () {
  'use strict';

  Object.assign(PortalShell, {
    toggleAccountMenu() {
      this.state.accountMenuOpen = !this.state.accountMenuOpen;
    },
    logout() {
      AuthService.logout();
      Nav.go('/login');
    },
    renderHeader() {
      const c = this.config;
      const s = this.state;
      return U.tpl('portal-header', [
        c.title,
        c.loadTerritory && s.myTerritory ? U.tpl('portal-header-1', [s.myTerritory]) : '',
        s.accountMenuOpen
          ? U.tpl('portal-header-2', [
              AuthService.email(),
              c.verificationLink ? U.tpl('portal-header-2-1', [Nav.href(c.verificationLink)]) : '',
            ])
          : '',
      ]);
    },
  });
})();
