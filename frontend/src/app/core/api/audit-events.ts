import { HttpContextToken } from '@angular/common/http';
import { normalizedRequestPath } from './audit-action.util';

/**
 * Which portal mutations are worth an audit-log entry, and what to call them.
 *
 * The audit interceptor used to log every successful POST/PUT/PATCH/DELETE from every role. Now an
 * entry is written only when (a) an INTERNAL role performed it and (b) the request is one of the
 * meaningful business actions below - everything else (customer/partner activity, cart, checkout,
 * messages, uploads, reads, ...) is simply not listed and therefore never audited.
 *
 * The action stored is the human-readable business action ("Activate Location Manager"), not the
 * HTTP method/URL; the technical request is kept only in the entry's detail JSON.
 */

/** Set by a caller that knows more than the URL does - e.g. which kind of subject a verification
 *  decision was about ("FLEET_OWNER" -> "Approve Fleet Owner"). */
export const AUDIT_SUBJECT = new HttpContextToken<string | null>(() => null);

interface AuditRequest {
  body: unknown;
  subject: string | null;
}

const SUBJECT_NOUNS: Record<string, string> = {
  RETAILER: 'Retailer',
  FLEET_OWNER: 'Fleet Owner',
  DRIVER: 'Driver',
  VEHICLE: 'Vehicle',
};

const field = (body: unknown, name: string): string | null => {
  const value = body && typeof body === 'object' ? (body as Record<string, unknown>)[name] : null;
  return typeof value === 'string' || typeof value === 'boolean' ? String(value).toUpperCase() : null;
};

/** ACTIVE -> "Activate X", INACTIVE/SUSPENDED/... -> "Deactivate X"; anything else -> "Update X Status". */
function statusAction(status: string | null, noun: string): string {
  if (status === 'ACTIVE' || status === 'TRUE') return `Activate ${noun}`;
  if (status === 'INACTIVE' || status === 'SUSPENDED' || status === 'FALSE') return `Deactivate ${noun}`;
  return `Update ${noun} Status`;
}

const decision = (request: AuditRequest, fallbackNoun: string): string => {
  const noun = (request.subject && SUBJECT_NOUNS[request.subject]) || fallbackNoun;
  return `${field(request.body, 'result') === 'APPROVED' ? 'Approve' : 'Reject'} ${noun}`;
};

/** `METHOD normalized-path` (ids, api prefix and version removed) -> action. */
const AUDITED_ACTIONS: Record<string, (request: AuditRequest) => string> = {
  // Users / accounts
  'POST user-accounts': () => 'Create User',
  'PUT user-accounts': () => 'Update User',
  'PATCH user-accounts/status': (r) => statusAction(field(r.body, 'accountStatus'), 'User'),
  'DELETE user-accounts': () => 'Delete User',

  // Operations managers
  'POST operations-managers': () => 'Create Operations Manager',
  'PUT operations-managers': () => 'Update Operations Manager',
  'PATCH operations-managers/status': (r) => statusAction(field(r.body, 'status'), 'Operations Manager'),
  'PATCH operations-managers/city': () => 'Reassign Operations Manager',
  'DELETE operations-managers': () => 'Delete Operations Manager',

  // Location managers
  'POST location-managers': () => 'Assign Location Manager',
  'POST location-managers/officers': () => 'Create Location Manager',
  'PATCH location-managers/activate': () => 'Activate Location Manager',
  'PATCH location-managers/deactivate': () => 'Deactivate Location Manager',
  'PUT location-managers/transfer': () => 'Transfer Location Manager',
  'POST verification-queues/transfer-work': () => 'Transfer Verification Work',

  // Territory
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

  // Verification (retailer / fleet owner / driver / vehicle applications)
  'PATCH verification-queues/assign': () => 'Assign Verification',
  'POST verification-queues/submit-for-verification': () => 'Submit Verification',
  'POST verification-queues/process-result': (r) => decision(r, 'Verification'),
  'POST verification-queues/revoke': () => 'Revoke Approval',
  'POST verification-documents/decision': (r) => decision({ ...r, subject: null }, 'Verification Document'),

  // Support
  'POST support-tickets/assign': () => 'Assign Support Ticket',
  'POST support-tickets/escalate': () => 'Escalate Support Ticket',
  'POST support-tickets/resolve': () => 'Resolve Support Ticket',
  'POST support-tickets/close': () => 'Close Support Ticket',

  // Finance / operations decisions
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

export interface AuditEvent {
  action: string;
  sourceModule: string;
}

/** The audit entry for this request, or null when it is not a meaningful business action. */
export function resolveAuditEvent(method: string, pathname: string, body: unknown, subject: string | null): AuditEvent | null {
  const path = normalizedRequestPath(pathname);
  const build = AUDITED_ACTIONS[`${method.toUpperCase()} ${path}`];
  if (!build) return null;
  const module = path.split('/')[0].replace(/[-_]+/g, ' ').toUpperCase();
  return { action: build({ body, subject }), sourceModule: module };
}
