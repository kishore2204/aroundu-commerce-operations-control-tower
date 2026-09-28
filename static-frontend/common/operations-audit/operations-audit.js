/* Audit log (operations / admin) - port of features/operations/audit/audit.component.* and core/api/audit-action.util.ts */
(function () {
  /* ---------------------------------------------------------------- audit-action.util.ts */
  const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const UUID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const HTTP_ACTION = /^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)/i;

  function isNoiseSegment(segment, enumKeysAreIds) {
    return (
      segment.toLowerCase() === 'api' ||
      segment.toLowerCase() === 'me' ||
      /^v\d+$/i.test(segment) ||
      /^\d+$/.test(segment) ||
      UUID_SEGMENT.test(segment) ||
      (enumKeysAreIds && /^[A-Z0-9_]+$/.test(segment))
    );
  }
  function meaningfulSegments(path, enumKeysAreIds = true) {
    return path
      .split('?')[0]
      .split('/')
      .filter(Boolean)
      .filter((s) => !isNoiseSegment(s, enumKeysAreIds))
      .map((s) => s.toLowerCase());
  }
  const titleCase = (text) =>
    text
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  function singular(word) {
    if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
    if (word.endsWith('sses')) return word.slice(0, -2);
    if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    return word;
  }
  const NOUNS = {
    'location-managers': 'Location Manager',
    'operations-managers': 'Operations Manager',
    'fleet-owners': 'Fleet Owner',
    'user-accounts': 'User Account',
    'verification-queues': 'Verification',
    'verification-documents': 'Verification Document',
    'support-tickets': 'Support Ticket',
    'customer-refunds': 'Refund',
    'payment-transactions': 'Payment',
    'logistics-bookings': 'Logistics Booking',
    'logistics-rates': 'Logistics Rate',
    'tax-configurations': 'Tax Configuration',
    'order-items': 'Order Item',
  };
  const TAIL_ACTIONS = {
    activate: 'Activate {n}',
    deactivate: 'Deactivate {n}',
    approve: 'Approve {n}',
    reject: 'Reject {n}',
    complete: 'Complete {n}',
    resolve: 'Resolve {n}',
    close: 'Close {n}',
    assign: 'Assign {n}',
    escalate: 'Escalate {n}',
    cancel: 'Cancel {n}',
    submit: 'Submit {n}',
    revoke: 'Revoke {n}',
    register: 'Register {n}',
    status: 'Update {n} Status',
    city: 'Reassign {n} City',
    documents: 'Upload {n} Documents',
    upload: 'Upload {n}',
    decision: 'Review {n}',
    'process-result': 'Record {n} Decision',
    messages: 'Add {n} Message',
    proof: 'Upload {n} Proof',
    read: 'Mark {n} As Read',
    'retailer-accept': 'Accept {n} (Retailer)',
    'retailer-reject': 'Reject {n} (Retailer)',
    'pickup/confirm': 'Confirm {n} Pickup',
    'submit-verification': 'Submit Verification',
    'submit-for-verification': 'Submit Verification',
  };
  const SPECIFIC_ACTIONS = {
    'POST location-managers': 'Assign Location Manager',
    'POST location-managers/officers': 'Create Location Manager',
    'PUT users': 'Update Profile',
    'PATCH customers': 'Update Customer Profile',
    'POST customers/addresses': 'Add Address',
    'PATCH customers/addresses': 'Update Address',
    'DELETE customers/addresses': 'Delete Address',
    'PUT customers/addresses/default': 'Set Default Address',
    'POST customers/wishlist-items': 'Add To Wishlist',
    'DELETE customers/wishlist-items': 'Remove From Wishlist',
    'POST cart/items': 'Add To Cart',
    'PATCH cart/items': 'Update Cart Item',
    'DELETE cart/items': 'Remove From Cart',
    'DELETE cart': 'Clear Cart',
    'POST cart/validate': 'Validate Cart',
    'POST cart/items/move-to-wishlist': 'Move Cart Item To Wishlist',
    'POST cart/serviceability-check': 'Check Cart Serviceability',
    'POST checkout/prepare': 'Prepare Checkout',
    'POST reviews': 'Submit Review',
    'POST retailers/products': 'Create Product',
    'PATCH retailers/products': 'Update Product',
    'DELETE retailers/products': 'Delete Product',
    'POST retailers/products/duplicate': 'Duplicate Product',
    'POST retailers/products/images': 'Upload Product Images',
    'POST retailers/inventory/adjustments': 'Adjust Inventory',
    'PATCH verification-queues/assign': 'Assign Verification Reviewer',
    'POST customer-refunds': 'Request Refund',
    'POST notifications': 'Send Notification',
    'POST payment-transactions': 'Record Payment',
    'POST drivers': 'Add Driver',
    'POST vehicles': 'Add Vehicle',
  };
  const METHOD_VERBS = { POST: 'Create', PUT: 'Update', PATCH: 'Update', DELETE: 'Delete', GET: 'View' };

  function fromRequest(method, path) {
    const segments = meaningfulSegments(path);
    if (segments.length === 0) return null;
    const upperMethod = method.toUpperCase();
    const specific = SPECIFIC_ACTIONS[`${upperMethod} ${segments.join('/')}`];
    if (specific) return specific;
    const resource = segments[0];
    const noun = NOUNS[resource] ?? titleCase(singular(resource));
    const tail = segments.slice(1).join('/');
    if (!tail) return `${METHOD_VERBS[upperMethod] ?? titleCase(upperMethod)} ${noun}`;
    const template = TAIL_ACTIONS[tail] ?? (segments.length === 2 ? undefined : TAIL_ACTIONS[segments[segments.length - 1]]);
    if (template) return template.replace('{n}', noun);
    return `${METHOD_VERBS[upperMethod] ?? titleCase(upperMethod)} ${titleCase(tail)} ${noun}`.trim();
  }
  function formatAuditAction(log) {
    const raw = (log.action ?? '').trim();
    const request = HTTP_ACTION.exec(raw);
    if (request) return fromRequest(request[1], request[2]) ?? 'Portal Action';
    return titleCase(raw.replace(UUID_ANYWHERE, ' ')) || 'Portal Action';
  }
  function formatAuditModule(log) {
    const fromSource = log.sourceModule ? meaningfulSegments(log.sourceModule, false)[0] : undefined;
    if (fromSource) return fromSource.replace(/[-_]+/g, ' ').toUpperCase();
    const request = HTTP_ACTION.exec((log.action ?? '').trim());
    const fromAction = request ? meaningfulSegments(request[2])[0] : undefined;
    return fromAction ? fromAction.replace(/[-_]+/g, ' ').toUpperCase() : 'unknown module';
  }

  /* ---------------------------------------------------------------- page */
  window.OperationsAuditPage = {
    tag: 'app-operations-audit',
    init() {
      const s = (this.state = U.state({ logs: [], loading: true }));
      AuditLogService.list().then(
        (logs) => {
          s.logs = logs.sort((a, b) => b.performedAt.localeCompare(a.performedAt));
          s.loading = false;
        },
        () => {
          s.loading = false;
        },
      );
    },
    rows() {
      return this.state.logs.map((log) => ({
        auditLogId: log.auditLogId,
        action: formatAuditAction(log),
        module: formatAuditModule(log),
        performedAt: log.performedAt,
        ipAddress: log.ipAddress,
      }));
    },
    exportCsv() {
      const header = ['Action', 'Source module', 'Performed at', 'IP address'];
      const escape = (value) => `"${value.replace(/"/g, '""')}"`;
      const rows = this.rows().map((row) => [row.action, row.module, row.performedAt, row.ipAddress || ''].map(escape).join(','));
      const csv = [header.map(escape).join(','), ...rows].join('\r\n');
      U.download(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    },
    render() {
      const s = this.state;
      return U.tpl('operations-audit', [
        !s.loading && s.logs.length > 0 ? U.tpl('operations-audit-1') : '',
        s.loading
          ? U.tpl('operations-audit-2')
          : s.logs.length === 0
            ? EmptyState({ icon: 'history', title: 'No audit log entries' })
            : U.tpl('operations-audit-3', [
                U.each(this.rows(), (log) =>
                  U.tpl('operations-audit-3-1', [
                    log.auditLogId,
                    log.action,
                    log.module,
                    U.date(log.performedAt, 'medium'),
                    log.ipAddress || '-',
                  ]),
                ),
              ]),
      ]);
    },
  };
})();
