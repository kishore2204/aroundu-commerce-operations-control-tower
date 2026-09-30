/*
 * The static replacement for Angular's HttpClient + interceptors: every "request" is answered locally
 * by MockBackend (data-store.js) - there is no network call anywhere in this project.
 *
 *   Api.get(url, params)            -> Promise<body>
 *   Api.post/put/patch(url, body)   -> Promise<body>
 *   Api.delete(url)                 -> Promise<body>
 *
 * A failed call rejects with { status, error, url } - the same shape Angular's HttpErrorResponse has,
 * so U.extractErrorMessage() (port of core/api/http-error.util.ts) works unchanged.
 * Like the Angular interceptors: the session token is attached, a 401 on a non-auth call signs the
 * user out, and business actions of internal roles are written to the audit log.
 */
(function () {
  'use strict';

  const SESSION_KEY = 'aroundu.session';
  const INTERNAL_ROLES = ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'LOCATION_MANAGER', 'SUPPORT_STAFF'];

  function readSession() {
    try {
      const raw = AppStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /* --------------------------------------------------------------------------------------------- */
  /* audit-events.ts                                                                               */
  /* --------------------------------------------------------------------------------------------- */
  const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function isNoiseSegment(segment, enumKeysAreIds) {
    return segment.toLowerCase() === 'api' || segment.toLowerCase() === 'me' || /^v\d+$/i.test(segment) || /^\d+$/.test(segment)
      || UUID_SEGMENT.test(segment) || (enumKeysAreIds && /^[A-Z0-9_]+$/.test(segment));
  }
  function meaningfulSegments(path, enumKeysAreIds = true) {
    return path.split('?')[0].split('/').filter(Boolean).filter((s) => !isNoiseSegment(s, enumKeysAreIds)).map((s) => s.toLowerCase());
  }
  const normalizedRequestPath = (path) => meaningfulSegments(path).join('/');
  const SUBJECT_NOUNS = { RETAILER: 'Retailer', FLEET_OWNER: 'Fleet Owner', DRIVER: 'Driver', VEHICLE: 'Vehicle' };
  const field = (body, name) => {
    const value = body && typeof body === 'object' ? body[name] : null;
    return typeof value === 'string' || typeof value === 'boolean' ? String(value).toUpperCase() : null;
  };
  function statusAction(status, noun) {
    if (status === 'ACTIVE' || status === 'TRUE') return `Activate ${noun}`;
    if (status === 'INACTIVE' || status === 'SUSPENDED' || status === 'FALSE') return `Deactivate ${noun}`;
    return `Update ${noun} Status`;
  }
  const decision = (r, fallbackNoun) => {
    const noun = (r.subject && SUBJECT_NOUNS[r.subject]) || fallbackNoun;
    return `${field(r.body, 'result') === 'APPROVED' ? 'Approve' : 'Reject'} ${noun}`;
  };
  const AUDITED_ACTIONS = {
    'POST user-accounts': () => 'Create User',
    'PUT user-accounts': () => 'Update User',
    'PATCH user-accounts/status': (r) => statusAction(field(r.body, 'accountStatus'), 'User'),
    'DELETE user-accounts': () => 'Delete User',
    'POST operations-managers': () => 'Create Operations Manager',
    'PUT operations-managers': () => 'Update Operations Manager',
    'PATCH operations-managers/status': (r) => statusAction(field(r.body, 'status'), 'Operations Manager'),
    'PATCH operations-managers/city': () => 'Reassign Operations Manager',
    'DELETE operations-managers': () => 'Delete Operations Manager',
    'POST location-managers': () => 'Assign Location Manager',
    'POST location-managers/officers': () => 'Create Location Manager',
    'PATCH location-managers/activate': () => 'Activate Location Manager',
    'PATCH location-managers/deactivate': () => 'Deactivate Location Manager',
    'PUT location-managers/transfer': () => 'Transfer Location Manager',
    'POST verification-queues/transfer-work': () => 'Transfer Verification Work',
    'POST states': () => 'Create State',
    'PUT states': (r) => (field(r.body, 'isActive') ? statusAction(field(r.body, 'isActive'), 'State') : 'Update State'),
    'DELETE states': () => 'Delete State',
    'POST cities': () => 'Create City',
    'PUT cities': () => 'Update City',
    'DELETE cities': () => 'Delete City',
    'PATCH cities/activate': () => 'Activate City',
    'PATCH cities/deactivate': () => 'Deactivate City',
    'POST zones': () => 'Create Zone',
    'PUT zones': () => 'Update Zone',
    'PATCH zones/activate': () => 'Activate Zone',
    'PATCH zones/deactivate': () => 'Deactivate Zone',
    'PATCH verification-queues/assign': () => 'Assign Verification',
    'POST verification-queues/submit-for-verification': () => 'Submit Verification',
    'POST verification-queues/process-result': (r) => decision(r, 'Verification'),
    'POST verification-queues/revoke': () => 'Revoke Approval',
    'POST verification-documents/decision': (r) => decision(Object.assign({}, r, { subject: null }), 'Verification Document'),
    'POST support-tickets/assign': () => 'Assign Support Ticket',
    'POST support-tickets/escalate': () => 'Escalate Support Ticket',
    'POST support-tickets/resolve': () => 'Resolve Support Ticket',
    'POST support-tickets/close': () => 'Close Support Ticket',
    'POST customer-refunds/approve': () => 'Approve Refund',
    'POST customer-refunds/reject': () => 'Reject Refund',
    'POST customer-refunds/complete': () => 'Complete Refund',
    'POST settlements': () => 'Create Settlement',
    'PUT settlements': () => 'Update Settlement',
    'POST settlements/complete': () => 'Complete Settlement',
    'DELETE settlements': () => 'Delete Settlement',
    'POST tax-configurations': () => 'Create Tax Configuration',
    'PUT tax-configurations': () => 'Update Tax Configuration',
    'DELETE tax-configurations': () => 'Delete Tax Configuration',
    'PUT logistics-rates': () => 'Update Logistics Rate',
  };
  function resolveAuditEvent(method, pathname, body, subject) {
    const path = normalizedRequestPath(pathname);
    const build = AUDITED_ACTIONS[`${method.toUpperCase()} ${path}`];
    if (!build) return null;
    return { action: build({ body, subject }), sourceModule: path.split('/')[0].replace(/[-_]+/g, ' ').toUpperCase() };
  }

  /* --------------------------------------------------------------------------------------------- */
  /* request                                                                                       */
  /* --------------------------------------------------------------------------------------------- */

  function buildUrl(url, params) {
    if (!params) return url;
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') search.set(k, String(v)); });
    const qs = search.toString();
    return qs ? url + (url.includes('?') ? '&' : '?') + qs : url;
  }

  function request(method, url, options = {}) {
    const session = readSession();
    const isAuthEndpoint = url.includes('/api/v1/auth/');
    const fullUrl = buildUrl(url, options.params);
    const mutation = method !== 'GET';
    return new Promise((resolve, reject) => {
      const run = () => {
        const res = MockBackend.handle({ method, url: fullUrl, body: options.body, token: isAuthEndpoint || !session ? null : session.accessToken });
        if (res.status >= 200 && res.status < 300) {
          // audit interceptor: meaningful business actions of internal roles only
          if (mutation && session && INTERNAL_ROLES.includes(session.role)) {
            const audit = resolveAuditEvent(method, fullUrl.split('?')[0], options.body, options.auditSubject || null);
            if (audit) {
              MockBackend.handle({
                method: 'POST', url: '/api/audit-logs', token: session.accessToken,
                body: { userAccountId: session.userAccountId, action: audit.action, sourceModule: audit.sourceModule, oldValues: null, newValues: JSON.stringify({ status: res.status, role: session.role, request: `${method} ${fullUrl.split('?')[0]}` }).slice(0, 250), ipAddress: null },
              });
            }
          }
          resolve(res.body);
        } else {
          const error = { status: res.status, error: res.body, url: fullUrl };
          if (res.status === 401 && !isAuthEndpoint && session) {
            AppStorage.removeItem(SESSION_KEY);
            // like router.navigate() in the Angular interceptor, this supersedes any navigation already under way
            Nav.sessionExpired = true;
            window.location.replace(AppStorage.handoff(Nav.href('/login', { sessionExpired: 'true' })));
          }
          reject(error);
        }
        App.update();
      };
      // reads answer in the next task, as an HTTP response would (loading states render in between, exactly as in
      // Angular); writes take a moment, like a real round trip (busy states stay visible)
      if (mutation && !isAuthEndpoint) setTimeout(run, 250);
      else if (mutation) setTimeout(run, 350);
      else setTimeout(run, 0);
    });
  }

  const unwrap = (response) => response.data;

  /* File -> { name, size, type, dataUrl } (what the simulated upload endpoints store) */
  function readFile(file) {
    return new Promise((resolve) => {
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, size: file.size, type: file.type, dataUrl: reader.result });
      reader.onerror = () => resolve({ name: file.name, size: file.size, type: file.type, dataUrl: null });
      reader.readAsDataURL(file);
    });
  }

  window.Api = {
    SESSION_KEY,
    readSession,
    request,
    unwrap,
    readFile,
    get: (url, params) => request('GET', url, { params }),
    post: (url, body, options = {}) => request('POST', url, Object.assign({ body }, options)),
    put: (url, body, options = {}) => request('PUT', url, Object.assign({ body }, options)),
    patch: (url, body, options = {}) => request('PATCH', url, Object.assign({ body }, options)),
    delete: (url, options = {}) => request('DELETE', url, options),
    normalizedRequestPath,
    meaningfulSegments,
  };
})();
