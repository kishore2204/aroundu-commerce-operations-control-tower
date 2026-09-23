import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { AddressListComponent } from './address-list.component';
import { AddressService } from '../../core/services/address.service';
import { TerritoryService } from '../../core/services/territory.service';
import { Address } from '../../core/models/address.model';

describe('AddressListComponent', () => {
  const address: Address = {
    id: 'a1',
    cityId: 'c1',
    cityName: 'Chennai',
    zoneId: 'z1',
    zoneName: 'North',
    addressTag: 'HOME',
    line1: '12 Main St',
    line2: null,
    postalCode: '600001',
    latitude: null,
    longitude: null,
    defaultAddress: false,
  };

  function setup(addressServiceSpy: Partial<AddressService>) {
    TestBed.configureTestingModule({
      imports: [AddressListComponent],
      providers: [
        { provide: AddressService, useValue: addressServiceSpy },
        { provide: TerritoryService, useValue: { cities: () => of({ content: [], totalElements: 0, totalPages: 0, size: 100, number: 0 }), zones: () => of({ content: [], totalElements: 0, totalPages: 0, size: 100, number: 0 }) } },
      ],
    });
    const fixture = TestBed.createComponent(AddressListComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('lists every loaded address', () => {
    const fixture = setup({ list: () => of({ items: [address], page: 0, size: 20, totalElements: 1, totalPages: 1 }) });
    const rows = fixture.debugElement.queryAll(By.css('.items li'));
    expect(rows.length).toBe(1);
    expect(rows[0].nativeElement.textContent).toContain('12 Main St');
  });

  it('emits addressSelected when a row is clicked', () => {
    const fixture = setup({ list: () => of({ items: [address], page: 0, size: 20, totalElements: 1, totalPages: 1 }) });
    const emitted: Address[] = [];
    fixture.componentInstance.addressSelected.subscribe((a) => emitted.push(a));

    fixture.debugElement.query(By.css('.items li')).nativeElement.click();

    expect(emitted).toEqual([address]);
  });

  it('hides the page title when embedded', () => {
    const fixture = setup({ list: () => of({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }) });
    fixture.componentInstance.embedded = true;
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('h1'))).toBeNull();
  });
});
