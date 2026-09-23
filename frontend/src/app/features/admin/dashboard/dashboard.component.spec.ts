import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { AdminDashboardComponent } from './dashboard.component';
import { AnalyticsService } from '../../../core/services/audit-log.service';
import { UserAccountService } from '../../../core/services/user-account.service';
import { VerificationQueueService } from '../../../core/services/verification-queue.service';
import { AnalyticsOverview } from '../../../core/models/audit-log.model';
import { UserAccount } from '../../../core/models/user-account.model';

describe('AdminDashboardComponent', () => {
  const overview: AnalyticsOverview = {
    paymentTransactions: 10,
    invoices: 5,
    refunds: 2,
    settlements: 3,
    supportTickets: 4,
    notifications: 1,
    auditLogs: 20,
    recordedPaymentAmount: 1000,
    refundRate: 5.5,
    settlementFeeRatio: 0.1,
    averageTicketResolutionHours: 2.5,
  };

  function account(id: string, role: string): UserAccount {
    return {
      id,
      email: `${id}@example.com`,
      phoneNumber: '9999999999',
      firstName: 'A',
      lastName: 'B',
      role,
      accountStatus: 'ACTIVE',
      passwordChangedOn: null,
      lastLoginAt: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };
  }

  function setup(opts: {
    overview?: AnalyticsOverview;
    accounts?: UserAccount[];
    pending?: unknown[];
  } = {}) {
    TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AnalyticsService, useValue: { overview: () => of(opts.overview ?? overview) } },
        { provide: UserAccountService, useValue: { all: () => of(opts.accounts ?? []) } },
        { provide: VerificationQueueService, useValue: { byStatus: () => of(opts.pending ?? []) } },
      ],
    });
    return TestBed.createComponent(AdminDashboardComponent);
  }

  it('should create', () => {
    const fixture = setup();
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads the overview, pending review count and role counts on init', () => {
    const fixture = setup({
      accounts: [account('1', 'CUSTOMER'), account('2', 'CUSTOMER'), account('3', 'RETAILER')],
      pending: [{}, {}],
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.componentInstance.overview()).toEqual(overview);
    expect(fixture.componentInstance.pendingReview()).toBe(2);
    expect(fixture.componentInstance.accountCount()).toBe(3);
    expect(fixture.componentInstance.roleCounts()).toEqual([
      { role: 'CUSTOMER', count: 2 },
      { role: 'RETAILER', count: 1 },
    ]);
  });

  it('renders the finance snapshot once loaded', () => {
    const fixture = setup();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.metrics'))).not.toBeNull();
  });
});
