import type { AuditLog } from '../models/audit-log.model';

/**
 * User-facing wording for audit-log rows.
 *
 * New audit entries already store a readable business action ("Activate Location Manager", see
 * core/api/audit-events.ts) and a clean module. Entries written before that - the interceptor used
 * to persist every mutation as `"<METHOD> <path>"` such as
 * `PATCH /api/v1/location-managers/<uuid>/activate` - are still in the immutable log, so the Audit
 * Log screen (and its CSV export) run every row through this file, which turns such a raw request
 * into its business action and module and never lets a method, path or id reach the screen.
 * Nothing in this file changes what is stored.
 */

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const HTTP_ACTION = /^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)/i;

/** Path segments that carry no business meaning: the gateway prefix, api versions, ids, "me".
 *  `enumKeysAreIds` additionally treats ALL_CAPS segments as path parameters (e.g.
 *  /api/logistics-rates/MINI_TRUCK) - true for request paths, but not for the persisted
 *  sourceModule, which the interceptor upper-cases in full. */
function isNoiseSegment(segment: string, enumKeysAreIds: boolean): boolean {
  return (
    segment.toLowerCase() === 'api' ||
    segment.toLowerCase() === 'me' ||
    /^v\d+$/i.test(segment) ||
    /^\d+$/.test(segment) ||
    UUID_SEGMENT.test(segment) ||
    (enumKeysAreIds && /^[A-Z0-9_]+$/.test(segment))
  );
}

function meaningfulSegments(path: string, enumKeysAreIds = true): string[] {
  return path
    .split('?')[0]
    .split('/')
    .filter(Boolean)
    .filter((segment) => !isNoiseSegment(segment, enumKeysAreIds))
    .map((segment) => segment.toLowerCase());
}

/** `api`/version/ids/"me" stripped, e.g. `/api/v1/zones/<uuid>/activate` -> `zones/activate`. */
export function normalizedRequestPath(path: string): string {
  return meaningfulSegments(path).join('/');
}

const titleCase = (text: string): string =>
  text
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

function singular(word: string): string {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('sses')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** How a top-level resource is named in an action ("Activate <noun>"). Anything not listed falls
 *  back to the singular, title-cased resource name. */
const NOUNS: Record<string, string> = {
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

/** Trailing path words that name the operation ("/{id}/activate"). `{n}` is the resource noun. */
const TAIL_ACTIONS: Record<string, string> = {
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

/** Nested / irregular endpoints where "<verb> <resource>" would read wrongly. Key: `METHOD path`
 *  with ids, "me", api prefix and version removed. */
const SPECIFIC_ACTIONS: Record<string, string> = {
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

const METHOD_VERBS: Record<string, string> = { POST: 'Create', PUT: 'Update', PATCH: 'Update', DELETE: 'Delete', GET: 'View' };

function fromRequest(method: string, path: string): string | null {
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

/** The business action for an audit row - never contains an HTTP method, path or id. */
export function formatAuditAction(log: Pick<AuditLog, 'action'>): string {
  const raw = (log.action ?? '').trim();
  const request = HTTP_ACTION.exec(raw);
  if (request) {
    return fromRequest(request[1], request[2]) ?? 'Portal Action';
  }
  // Non-request entries (e.g. SEED_DATA_INITIALIZED, ORDER_STATUS_CHANGED_SEED_<uuid>).
  const readable = titleCase(raw.replace(UUID_ANYWHERE, ' '));
  return readable || 'Portal Action';
}

/** The module an audit row belongs to, e.g. "LOCATION MANAGERS" - never a path or an id. */
export function formatAuditModule(log: Pick<AuditLog, 'action' | 'sourceModule'>): string {
  const fromSource = log.sourceModule ? meaningfulSegments(log.sourceModule, false)[0] : undefined;
  if (fromSource) return fromSource.replace(/[-_]+/g, ' ').toUpperCase();
  const request = HTTP_ACTION.exec((log.action ?? '').trim());
  const fromAction = request ? meaningfulSegments(request[2])[0] : undefined;
  return fromAction ? fromAction.replace(/[-_]+/g, ' ').toUpperCase() : 'unknown module';
}
