import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { OperationsDashboardComponent } from './dashboard.component';
import { AnalyticsService } from '../../../core/services/audit-log.service';
import { VerificationQueueService } from '../../../core/services/verification-queue.service';
import { AnalyticsOverview } from '../../../core/models/audit-log.model';
import { VerificationQueue } from '../../../core/models/verification.model';

describe('OperationsDashboardComponent', () => {
  const overview: AnalyticsOverview = {
    paymentTransactions: 10,
    invoices: 5,
    refunds: 1,
    settlements: 3,
    supportTickets: 4,
    notifications: 20,
    auditLogs: 50,
    recordedPaymentAmount: 1000,
    refundRate: 2.5,
    settlementFeeRatio: 1.25,
    averageTicketResolutionHours: 6.4,
  };

  function setup(overrides: { overview?: jasmine.Spy; byStatus?: jasmine.Spy } = {}) {
    const analyticsServiceSpy = {
      overview: overrides.overview ?? jasmine.createSpy().and.returnValue(of(overview)),
    };
    const queueServiceSpy = {
      byStatus: overrides.byStatus ?? jasmine.createSpy().and.returnValue(of([{}, {}] as VerificationQueue[])),
    };

    TestBed.configureTestingModule({
      imports: [OperationsDashboardComponent],
      providers: [
        { provide: AnalyticsService, useValue: analyticsServiceSpy },
        { provide: VerificationQueueService, useValue: queueServiceSpy },
        provideRouter([]),
      ],
    });

    const fixture = TestBed.createComponent(OperationsDashboardComponent);
    return { fixture, analyticsServiceSpy, queueServiceSpy };
  }

  it('should create', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads the analytics overview and the pending review count', () => {
    const { fixture, queueServiceSpy } = setup();
    fixture.detectChanges();

    expect(queueServiceSpy.byStatus).toHaveBeenCalledWith('SENT_TO_LOCATION_MANAGER');
    expect(fixture.componentInstance.overview()).toEqual(overview);
    expect(fixture.componentInstance.pendingReview()).toBe(2);
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('renders the finance snapshot once the overview loads', () => {
    const { fixture } = setup();
    fixture.detectChanges();

    const values = fixture.debugElement.queryAll(By.css('.metric-value'));
    expect(values.length).toBeGreaterThan(0);
  });

  it('stops loading without throwing when the overview request fails', () => {
    const overviewSpy = jasmine.createSpy().and.returnValue(throwError(() => new Error('down')));
    const { fixture } = setup({ overview: overviewSpy });

    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.componentInstance.overview()).toBeNull();
  });

  it('leaves pending review at 0 when the queue lookup fails', () => {
    const byStatusSpy = jasmine.createSpy().and.returnValue(throwError(() => new Error('down')));
    const { fixture } = setup({ byStatus: byStatusSpy });

    fixture.detectChanges();

    expect(fixture.componentInstance.pendingReview()).toBe(0);
  });
});
