import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OperationsSupportComponent } from './support.component';
import { AuthService } from '../../../core/auth/auth.service';
import { CustomerService } from '../../../core/services/customer.service';
import { NotificationService, SupportService } from '../../../core/services/notification.service';
import { SupportTicket } from '../../../core/models/notification.model';

describe('OperationsSupportComponent', () => {
  const ticket: SupportTicket = {
    customerTicketId: 't1',
    customerProfileId: null,
    orderId: null,
    raisedByAccountId: 'u1',
    raisedByRole: 'CUSTOMER',
    ticketCategory: 'PAYMENT_ISSUE',
    ticketSubCategory: 'DOUBLE_CHARGE',
    assignedSupportAccountId: null,
    ticketNumber: 'TCK-1',
    subject: 'Refund issue',
    description: 'details',
    priority: 'HIGH',
    ticketStatus: 'OPEN',
    escalatedToRole: null,
    escalatedByAccountId: null,
    escalationReason: null,
    escalatedAt: null,
    raisedAt: '2026-01-01T00:00:00Z',
    resolvedAt: null,
  };

  function setup(overrides: { tickets?: SupportTicket[]; escalated?: SupportTicket[] } = {}) {
    const supportService = {
      list: jasmine.createSpy().and.returnValue(of(overrides.tickets ?? [ticket])),
      mine: jasmine.createSpy().and.returnValue(of([])),
      escalatedToMe: jasmine.createSpy().and.returnValue(of(overrides.escalated ?? [])),
      assign: jasmine.createSpy().and.returnValue(of(ticket)),
      resolve: jasmine.createSpy().and.returnValue(of(ticket)),
      close: jasmine.createSpy().and.returnValue(of(ticket)),
    };
    const notificationService = {
      all: jasmine.createSpy().and.returnValue(of([])),
      create: jasmine.createSpy().and.returnValue(of({})),
    };
    const auth = { userAccountId: () => 'me-1', role: () => 'OPERATIONS_MANAGER' as const };
    const customerService = { me: jasmine.createSpy() };

    TestBed.configureTestingModule({
      imports: [OperationsSupportComponent],
      providers: [
        { provide: SupportService, useValue: supportService },
        { provide: NotificationService, useValue: notificationService },
        { provide: AuthService, useValue: auth },
        { provide: CustomerService, useValue: customerService },
        provideRouter([]),
      ],
    });

    const fixture = TestBed.createComponent(OperationsSupportComponent);
    return { fixture, supportService, notificationService };
  }

  it('should create', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads and sorts tickets on init', () => {
    const { fixture, supportService } = setup();
    fixture.detectChanges();

    expect(supportService.list).toHaveBeenCalled();
    expect(fixture.componentInstance.tickets()).toEqual([ticket]);
    expect(fixture.componentInstance.ticketsLoading()).toBeFalse();
  });

  it('loads the escalated-to-me queue on init', () => {
    const escalated = { ...ticket, customerTicketId: 't2', escalatedToRole: 'OPERATIONS_MANAGER' };
    const { fixture, supportService } = setup({ escalated: [escalated] });
    fixture.detectChanges();

    expect(supportService.escalatedToMe).toHaveBeenCalled();
    expect(fixture.componentInstance.escalatedTickets()).toEqual([escalated]);
  });

  it('assigns a ticket to the current user and reloads the list', () => {
    const { fixture, supportService } = setup();
    fixture.detectChanges();

    fixture.componentInstance.assignToMe(ticket);

    expect(supportService.assign).toHaveBeenCalledWith('t1', 'me-1');
    expect(supportService.list).toHaveBeenCalledTimes(2);
  });
});
