import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OperationsFinanceComponent } from './finance.component';
import { PaymentTransactionService, SettlementService } from '../../../core/services/settlement.service';
import { TaxConfigurationService } from '../../../core/services/tax-configuration.service';
import { Settlement } from '../../../core/models/settlement.model';

describe('OperationsFinanceComponent', () => {
  const settlement: Settlement = {
    settlementId: 's1',
    paymentTransactionId: 'pt1',
    grossAmount: 100,
    feeAmount: 10,
    netAmount: 90,
    settlementDate: '2026-01-01',
    settlementReference: 'REF-1',
    settlementStatus: 'PENDING',
  } as Settlement;

  function setup(overrides: { settlementList?: Settlement[] } = {}) {
    const settlementService = {
      list: jasmine.createSpy().and.returnValue(of(overrides.settlementList ?? [settlement])),
      create: jasmine.createSpy().and.returnValue(of(settlement)),
      complete: jasmine.createSpy().and.returnValue(of(settlement)),
    };
    const paymentTransactionService = {
      list: jasmine.createSpy().and.returnValue(of([])),
    };
    const taxService = {
      list: jasmine.createSpy().and.returnValue(of([])),
      create: jasmine.createSpy().and.returnValue(of({})),
      remove: jasmine.createSpy().and.returnValue(of(void 0)),
    };

    TestBed.configureTestingModule({
      imports: [OperationsFinanceComponent],
      providers: [
        { provide: SettlementService, useValue: settlementService },
        { provide: PaymentTransactionService, useValue: paymentTransactionService },
        { provide: TaxConfigurationService, useValue: taxService },
      ],
    });

    const fixture = TestBed.createComponent(OperationsFinanceComponent);
    return { fixture, settlementService, paymentTransactionService, taxService };
  }

  it('should create', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads settlements on init', () => {
    const { fixture, settlementService } = setup();
    fixture.detectChanges();

    expect(settlementService.list).toHaveBeenCalled();
    expect(fixture.componentInstance.settlements()).toEqual([settlement]);
    expect(fixture.componentInstance.settlementsLoading()).toBeFalse();
  });

  it('completes a settlement and reloads the list', () => {
    const { fixture, settlementService } = setup();
    fixture.detectChanges();

    fixture.componentInstance.complete(settlement);

    expect(settlementService.complete).toHaveBeenCalledWith('s1');
    expect(settlementService.list).toHaveBeenCalledTimes(2);
  });
});
