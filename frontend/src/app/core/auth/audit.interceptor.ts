import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { AuthService } from './auth.service';
import { AUDIT_SUBJECT, resolveAuditEvent } from '../api/audit-events';
import { INTERNAL_ROLES } from '../models/user.model';

/**
 * Records meaningful business actions performed by INTERNAL roles in S6's immutable audit log.
 *
 * It does NOT log every mutation any more: nothing is written for customers/partners, for reads,
 * or for mutations that are not listed in core/api/audit-events.ts. Only a request that actually
 * succeeded (an HttpResponse - failed calls never reach this branch) can produce an entry, and this
 * interceptor is the only place entries are created (the backend AuditRecorders have no callers),
 * so one action is logged exactly once. The write is fire-and-forget and never delays the action.
 */
export const auditInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const method = req.method.toUpperCase();
  const mutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  return next(req).pipe(tap((event) => {
    if (!(event instanceof HttpResponse) || !mutation || !auth.isAuthenticated()) return;
    const role = auth.role();
    if (!role || !INTERNAL_ROLES.includes(role)) return;
    const token = auth.accessToken();
    const userAccountId = auth.userAccountId();
    if (!token || !userAccountId) return;
    let pathname = req.url;
    try { pathname = new URL(req.url, window.location.origin).pathname; } catch {}
    const audit = resolveAuditEvent(method, pathname, req.body, req.context.get(AUDIT_SUBJECT));
    if (!audit) return;
    void fetch('/api/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        userAccountId, action: audit.action, sourceModule: audit.sourceModule, oldValues: null,
        // Technical detail stays here (internal use only); the screen shows just the action.
        newValues: JSON.stringify({ status: event.status, role, request: `${method} ${pathname}` }).slice(0, 250),
        ipAddress: null,
      }),
    }).catch(() => undefined);
  }));
};
