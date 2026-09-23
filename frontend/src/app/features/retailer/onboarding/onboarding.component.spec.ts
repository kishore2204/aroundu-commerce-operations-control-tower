import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RetailerOnboardingComponent } from './onboarding.component';
import { RetailerService } from '../../../core/services/retailer.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Retailer } from '../../../core/models/retailer.model';

describe('RetailerOnboardingComponent', () => {
  function retailer(overrides: Partial<Retailer> = {}): Retailer {
    return {
      retailerId: 'r1',
      userAccountId: 'u1',
      operationsManagerId: null,
      cityId: 'city-1',
      zoneId: null,
      longitude: null,
      latitude: null,
      businessName: 'Fresh Mart',
      registrationNumber: null,
      gstNumber: null,
      retailerStatus: 'PENDING_VERIFICATION',
      isOpen: true,
      opensAt: null,
      closesAt: null,
      ...overrides,
    };
  }

  function setup(retailerServiceSpy: Partial<RetailerService>) {
    TestBed.configureTestingModule({
      imports: [RetailerOnboardingComponent],
      providers: [
        { provide: RetailerService, useValue: retailerServiceSpy },
        { provide: AuthService, useValue: { userAccountId: () => 'u1' } },
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(RetailerOnboardingComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('should create', () => {
    const fixture = setup({ resolveMine: () => of(null) });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('registers a business and stores the returned retailer', () => {
    const register = jasmine.createSpy().and.returnValue(of(retailer()));
    const fixture = setup({ resolveMine: () => of(null), register });
    fixture.componentInstance.registerForm.setValue({
      businessName: 'Fresh Mart',
      cityId: 'city-1',
      zoneId: '',
      registrationNumber: '',
      gstNumber: '',
    });

    fixture.componentInstance.register();

    expect(register).toHaveBeenCalledWith({
      userAccountId: 'u1',
      businessName: 'Fresh Mart',
      cityId: 'city-1',
      zoneId: null,
      registrationNumber: null,
      gstNumber: null,
      retailerStatus: 'PENDING_VERIFICATION',
    });
    expect(fixture.componentInstance.retailer()).toEqual(retailer());
  });

  it('submits verification documents for the current retailer', () => {
    const submitDocuments = jasmine.createSpy().and.returnValue(of(undefined));
    const fixture = setup({
      resolveMine: () => of(retailer()),
      verificationStatus: () => of({ status: 'PENDING' }),
      submitDocuments,
    });
    fixture.componentInstance.documentRows.set([{ documentTypeName: 'GST_CERTIFICATE', fileName: 'gst.pdf' }]);

    fixture.componentInstance.submitDocuments();

    expect(submitDocuments).toHaveBeenCalledWith('r1', [
      { documentTypeName: 'GST_CERTIFICATE', fileName: 'gst.pdf', isCurrentVersion: true },
    ]);
    expect(fixture.componentInstance.documentsSubmitted()).toBeTrue();
  });

  it('surfaces an error message when document submission fails', () => {
    const submitDocuments = jasmine.createSpy().and.returnValue(throwError(() => new Error('down')));
    const fixture = setup({
      resolveMine: () => of(retailer()),
      verificationStatus: () => of({ status: 'PENDING' }),
      submitDocuments,
    });

    fixture.componentInstance.submitDocuments();

    expect(fixture.componentInstance.documentsError()).toContain('Could not submit documents.');
  });
});
