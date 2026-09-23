import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { ShopDetailExpanderComponent } from './shop-detail-expander.component';
import { RetailerService } from '../../core/services/retailer.service';
import { RetailerSummary } from '../../core/models/retailer.model';

describe('ShopDetailExpanderComponent', () => {
  const summary: RetailerSummary = {
    retailerId: 'r1',
    businessName: 'Fresh Mart',
    cityId: 'city-1',
    retailerStatus: 'VERIFIED',
    zoneId: 'zone-1',
    latitude: 12.9,
    longitude: 77.5,
  };

  function setup(retailerServiceSpy: Partial<RetailerService>) {
    TestBed.configureTestingModule({
      imports: [ShopDetailExpanderComponent],
      providers: [{ provide: RetailerService, useValue: retailerServiceSpy }],
    });
    const fixture = TestBed.createComponent(ShopDetailExpanderComponent);
    fixture.componentInstance.retailerId = 'r1';
    return fixture;
  }

  it('does not fetch shop details before the panel is expanded', () => {
    const getPublicSummary = jasmine.createSpy().and.returnValue(of(summary));
    const fixture = setup({ getPublicSummary, ratingSummary: () => of({ retailerId: 'r1', average: 4, count: 2 }) });
    fixture.detectChanges();

    expect(getPublicSummary).not.toHaveBeenCalled();
  });

  it('fetches and displays shop details once opened', () => {
    const getPublicSummary = jasmine.createSpy().and.returnValue(of(summary));
    const ratingSummary = jasmine.createSpy().and.returnValue(of({ retailerId: 'r1', average: 4.5, count: 10 }));
    const fixture = setup({ getPublicSummary, ratingSummary });
    fixture.detectChanges();

    fixture.componentInstance.onOpened();
    fixture.detectChanges();

    expect(getPublicSummary).toHaveBeenCalledWith('r1');
    expect(fixture.debugElement.query(By.css('.name')).nativeElement.textContent).toContain('Fresh Mart');
  });

  it('shows an error message rather than throwing when the lookup fails', () => {
    const getPublicSummary = jasmine.createSpy().and.returnValue(throwError(() => new Error('down')));
    const ratingSummary = jasmine.createSpy().and.returnValue(of({ retailerId: 'r1', average: 0, count: 0 }));
    const fixture = setup({ getPublicSummary, ratingSummary });
    fixture.detectChanges();

    fixture.componentInstance.onOpened();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.error'))).not.toBeNull();
  });

  it('emits shopSelected with the retailer id when "select this shop" is used', () => {
    const fixture = setup({ getPublicSummary: () => of(summary), ratingSummary: () => of({ retailerId: 'r1', average: 4, count: 1 }) });
    fixture.detectChanges();
    const emitted: string[] = [];
    fixture.componentInstance.shopSelected.subscribe((id) => emitted.push(id));

    fixture.componentInstance.selectShop();

    expect(emitted).toEqual(['r1']);
  });
});
