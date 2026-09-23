import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { RetailerStoreComponent } from './store.component';
import { RetailerService } from '../../../core/services/retailer.service';
import { Retailer } from '../../../core/models/retailer.model';

describe('RetailerStoreComponent', () => {
  function retailer(overrides: Partial<Retailer> = {}): Retailer {
    return {
      retailerId: 'r1',
      userAccountId: 'u1',
      operationsManagerId: null,
      cityId: 'city-1',
      zoneId: 'zone-1',
      longitude: 77.5,
      latitude: 12.9,
      businessName: 'Fresh Mart',
      registrationNumber: 'REG-1',
      gstNumber: 'GST-1',
      retailerStatus: 'VERIFIED',
      isOpen: true,
      opensAt: null,
      closesAt: null,
      ...overrides,
    };
  }

  function setup(retailerServiceSpy: Partial<RetailerService>) {
    TestBed.configureTestingModule({
      imports: [RetailerStoreComponent],
      providers: [{ provide: RetailerService, useValue: retailerServiceSpy }],
    });
    const fixture = TestBed.createComponent(RetailerStoreComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('should create', () => {
    const fixture = setup({ myRetailer: signal(null), resolveMine: () => of(null) });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('populates the form from the cached retailer without calling resolveMine', () => {
    const resolveMine = jasmine.createSpy();
    const fixture = setup({ myRetailer: signal(retailer()), resolveMine });

    expect(resolveMine).not.toHaveBeenCalled();
    expect(fixture.componentInstance.form.getRawValue().businessName).toBe('Fresh Mart');
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('saves changes by calling RetailerService.update with the current retailer id', () => {
    const update = jasmine.createSpy().and.returnValue(of(retailer({ businessName: 'Fresh Mart 2' })));
    const fixture = setup({ myRetailer: signal(retailer()), update });
    fixture.componentInstance.form.patchValue({ businessName: 'Fresh Mart 2' });

    fixture.componentInstance.save();

    expect(update).toHaveBeenCalledWith('r1', {
      userAccountId: 'u1',
      businessName: 'Fresh Mart 2',
      cityId: 'city-1',
      zoneId: 'zone-1',
      registrationNumber: 'REG-1',
      gstNumber: 'GST-1',
      latitude: 12.9,
      longitude: 77.5,
      retailerStatus: 'VERIFIED',
      isOpen: true,
      opensAt: null,
      closesAt: null,
    });
    expect(fixture.componentInstance.saved()).toBeTrue();
  });
});
