import { formatAuditAction, formatAuditModule } from './audit-action.util';

describe('audit action formatting', () => {
  const id = '3f2b8c1e-9a4d-4e6b-8c7a-1d2e3f4a5b6c';
  const entry = (method: string, path: string, sourceModule: string | null = null) => ({
    action: `${method} ${path}`,
    sourceModule,
  });

  it('turns request-style actions into business actions', () => {
    expect(formatAuditAction(entry('PATCH', `/api/v1/location-managers/${id}/activate`))).toBe('Activate Location Manager');
    expect(formatAuditAction(entry('PATCH', `/api/v1/location-managers/${id}/deactivate`))).toBe('Deactivate Location Manager');
    expect(formatAuditAction(entry('PATCH', `/api/v1/zones/${id}/deactivate`))).toBe('Deactivate Zone');
    expect(formatAuditAction(entry('POST', `/api/fleet-owners/${id}/submit-verification`))).toBe('Submit Verification');
    expect(formatAuditAction(entry('POST', '/api/v1/cart/items'))).toBe('Add To Cart');
  });

  it('never leaks the HTTP method, path or an id into the action', () => {
    const action = formatAuditAction(entry('DELETE', `/api/v1/customers/me/addresses/${id}`));
    expect(action).toBe('Delete Address');
    expect(action).not.toMatch(/api|\/|[0-9a-f]{8}-/i);
  });

  it('derives a clean module name from the stored source module or the request path', () => {
    expect(formatAuditModule(entry('PATCH', `/api/v1/location-managers/${id}/activate`, 'API/V1/LOCATION-MANAGERS'))).toBe('LOCATION MANAGERS');
    expect(formatAuditModule(entry('POST', `/api/fleet-owners/${id}/submit-verification`, `API/FLEET-OWNERS/${id.toUpperCase()}`))).toBe('FLEET OWNERS');
    expect(formatAuditModule(entry('PATCH', `/api/v1/zones/${id}/deactivate`, 'API/V1/ZONES'))).toBe('ZONES');
    expect(formatAuditModule({ action: 'CREATED_SETTLEMENT', sourceModule: 'FINANCE' })).toBe('FINANCE');
    expect(formatAuditModule({ action: 'PATCH /api/v1/zones/x/activate', sourceModule: null })).toBe('ZONES');
  });

  it('humanises non-request actions without ids', () => {
    expect(formatAuditAction({ action: 'SEED_DATA_INITIALIZED' })).toBe('Seed Data Initialized');
    expect(formatAuditAction({ action: `ORDER_STATUS_CHANGED_SEED_${id}` })).not.toMatch(/[0-9a-f]{8}-/i);
  });
});
