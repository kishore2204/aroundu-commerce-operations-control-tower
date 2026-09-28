/*
 * AuthService - port of the Angular AuthService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.AuthService = {
    session: Api.readSession(),
    accessToken() { return this.session ? this.session.accessToken : null; },
    role() { return this.session ? this.session.role : null; },
    userAccountId() { return this.session ? this.session.userAccountId : null; },
    email() { return this.session ? this.session.email : null; },
    isAuthenticated() { return this.session !== null; },
    isCustomer() { return this.role() === 'CUSTOMER'; },
    login(request) {
      this.logout();
      return Api.post('/api/v1/auth/login', request).then((response) => {
        this.session = { accessToken: response.accessToken, role: response.role, userAccountId: response.userAccountId, email: response.email };
        localStorage.setItem(Api.SESSION_KEY, JSON.stringify(this.session));
        App.update();
        return response;
      });
    },
    registerCustomer: (request) => Api.post('/api/v1/auth/register/customer', request),
    register: (request) => Api.post('/api/v1/auth/register', request),
    forgotPassword: (email) => Api.post('/api/v1/auth/forgot-password', { email }),
    resetPassword: (request) => Api.post('/api/v1/auth/reset-password', request),
    fetchCurrentUser: () => Api.get('/api/v1/users/me'),
    updateCurrentUser: (request) => Api.put('/api/v1/users/me', request),
    logout() {
      this.session = null;
      localStorage.removeItem(Api.SESSION_KEY);
      App.update();
    },
  };
})();
