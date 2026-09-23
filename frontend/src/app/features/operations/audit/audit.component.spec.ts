import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { OperationsAuditComponent } from './audit.component';
import { AuditLogService } from '../../../core/services/audit-log.service';
import { AuditLog } from '../../../core/models/audit-log.model';

describe('OperationsAuditComponent', () => {
  const logs: AuditLog[] = [
    {
      auditLogId: 'a1',
      userAccountId: 'u1',
      action: 'CREATED_SETTLEMENT',
      sourceModule: 'FINANCE',
      oldValues: null,
      newValues: null,
      ipAddress: '10.0.0.1',
      performedAt: '2026-01-01T10:00:00Z',
    },
    {
      auditLogId: 'a2',
      userAccountId: 'u2',
      action: 'RESOLVED_TICKET',
      sourceModule: null,
      oldValues: null,
      newValues: null,
      ipAddress: null,
      performedAt: '2026-01-02T10:00:00Z',
    },
  ];

  function setup(list: ReturnType<typeof jasmine.createSpy>) {
    TestBed.configureTestingModule({
      imports: [OperationsAuditComponent],
      providers: [{ provide: AuditLogService, useValue: { list } }],
    });
    const fixture = TestBed.createComponent(OperationsAuditComponent);
    return fixture;
  }

  it('creates the component', () => {
    const fixture = setup(jasmine.createSpy().and.returnValue(of([])));
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sorts audit logs newest-first and shows them once loaded', () => {
    const fixture = setup(jasmine.createSpy().and.returnValue(of(logs)));
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.componentInstance.logs()[0].auditLogId).toBe('a2');
    const items = fixture.debugElement.queryAll(By.css('.items li'));
    expect(items.length).toBe(2);
  });

  it('shows the empty state when there are no audit log entries', () => {
    const fixture = setup(jasmine.createSpy().and.returnValue(of([])));
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('app-empty-state'))).not.toBeNull();
  });

  it('stops loading without throwing when the audit log request fails', () => {
    const fixture = setup(jasmine.createSpy().and.returnValue(throwError(() => new Error('down'))));
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBeFalse();
  });
});
