import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OperationsTerritoryComponent } from './territory.component';
import { TerritoryService } from '../../../core/services/territory.service';
import { City, Zone } from '../../../core/models/territory.model';

describe('OperationsTerritoryComponent', () => {
  const city: City = { id: 'c1', cityName: 'Bengaluru', stateId: 'st1', stateName: 'Karnataka', active: true };
  const zone: Zone = { zoneId: 'z1', cityId: 'c1', cityName: 'Bengaluru', stateId: 'st1', stateName: 'Karnataka', zoneName: 'North', active: true };

  function setup(overrides: { cities?: City[]; zones?: Zone[] } = {}) {
    const service = {
      cities: jasmine.createSpy().and.returnValue(
        of({ content: overrides.cities ?? [city], totalElements: 1, totalPages: 1, size: 100, number: 0 }),
      ),
      zones: jasmine.createSpy().and.returnValue(
        of({ content: overrides.zones ?? [zone], totalElements: 1, totalPages: 1, size: 100, number: 0 }),
      ),
      createCity: jasmine.createSpy().and.returnValue(of(city)),
      setCityActive: jasmine.createSpy().and.returnValue(of(city)),
      createZone: jasmine.createSpy().and.returnValue(of(zone)),
      setZoneActive: jasmine.createSpy().and.returnValue(of(zone)),
    };

    TestBed.configureTestingModule({
      imports: [OperationsTerritoryComponent],
      providers: [{ provide: TerritoryService, useValue: service }],
    });

    const fixture = TestBed.createComponent(OperationsTerritoryComponent);
    return { fixture, service };
  }

  it('should create', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads cities and all zones on init', () => {
    const { fixture, service } = setup();
    fixture.detectChanges();

    expect(service.cities).toHaveBeenCalled();
    expect(service.zones).toHaveBeenCalledWith();
    expect(fixture.componentInstance.cities()).toEqual([city]);
    expect(fixture.componentInstance.zones()).toEqual([zone]);
  });

  it('selecting a city loads its zones', () => {
    const { fixture, service } = setup();
    fixture.detectChanges();
    service.zones.calls.reset();

    fixture.componentInstance.selectCity('c1');

    expect(service.zones).toHaveBeenCalledWith('c1');
    expect(fixture.componentInstance.selectedCityId()).toBe('c1');
  });
});
