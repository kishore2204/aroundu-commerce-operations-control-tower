import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { RetailerFinanceComponent } from './finance.component';
import { SettlementService } from '../../../core/services/settlement.service';
import { Settlement } from '../../../core/models/settlement.model';

describe('RetailerFinanceComponent', () => {
  const settlement: Settlement = {
    settlementId: 's1',
    operationsManagerId: null,
    paymentTransactionId: 'p1',
    settlementReference: 'REF-1',
    grossAmount: 100,
    feeAmount: 10,
    netAmount: 90,
    settlementStatus: 'PENDING',
    settlementDate: '2026-01-01',
    createdAt: '2026-01-01T00:00:00Z',
    completedAt: null,
  };

  function setup(list: jasmine.Spy) {
    TestBed.configureTestingModule({
      imports: [RetailerFinanceComponent],
      providers: [{ provide: SettlementService, useValue: { list } }],
    });
    const fixture = TestBed.createComponent(RetailerFinanceComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('should create', () => {
    const fixture = setup(jasmine.createSpy().and.returnValue(of([])));
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows the settlements empty state when there are none', () => {
    const fixture = setup(jasmine.createSpy().and.returnValue(of([])));
    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.debugElement.query(By.css('app-empty-state'))).not.toBeNull();
  });

  it('renders real settlement rows', () => {
    const fixture = setup(jasmine.createSpy().and.returnValue(of([settlement])));
    expect(fixture.componentInstance.settlements()).toEqual([settlement]);
    expect(fixture.debugElement.query(By.css('.settlement-table'))).not.toBeNull();
  });

  it('shows the empty state on error', () => {
    const fixture = setup(jasmine.createSpy().and.returnValue(throwError(() => new Error('network error'))));
    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.debugElement.query(By.css('app-empty-state'))).not.toBeNull();
  });
});
