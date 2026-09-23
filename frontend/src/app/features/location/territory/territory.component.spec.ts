import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LocationTerritoryComponent } from './territory.component';
import { TerritoryService } from '../../../core/services/territory.service';
import { City, Zone } from '../../../core/models/territory.model';
import { SpringPage } from '../../../core/api/api-response';

describe('LocationTerritoryComponent', () => {
  function page<T>(content: T[]): SpringPage<T> {
    return { content, totalElements: content.length, totalPages: 1, size: 100, number: 0 };
  }

  const city: City = { id: 'city-1', cityName: 'Bengaluru', stateId: 'state-1', stateName: 'Karnataka', active: true };
  const zone: Zone = {
    zoneId: 'zone-1',
    cityId: 'city-1',
    cityName: 'Bengaluru',
    stateId: 'state-1',
    stateName: 'Karnataka',
    zoneName: 'Indiranagar',
    active: true,
  };

  function setup() {
    const cities = jasmine.createSpy().and.returnValue(of(page([city])));
    const zones = jasmine.createSpy().and.returnValue(of(page([zone])));
    TestBed.configureTestingModule({
      imports: [LocationTerritoryComponent],
      providers: [{ provide: TerritoryService, useValue: { cities, zones } }],
    });
    const fixture = TestBed.createComponent(LocationTerritoryComponent);
    return { fixture, cities, zones };
  }

  it('should create', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads cities and all zones on init', () => {
    const { fixture, cities, zones } = setup();
    fixture.detectChanges();

    expect(cities).toHaveBeenCalled();
    expect(zones).toHaveBeenCalledWith();
    expect(fixture.componentInstance.cities()).toEqual([city]);
    expect(fixture.componentInstance.zones()).toEqual([zone]);
  });

  it('selecting a city loads its zones, and selecting it again reverts to all zones', () => {
    const { fixture, zones } = setup();
    fixture.detectChanges();
    zones.calls.reset();

    fixture.componentInstance.selectCity('city-1');
    expect(zones).toHaveBeenCalledWith('city-1');
    expect(fixture.componentInstance.selectedCityId()).toBe('city-1');

    zones.calls.reset();
    fixture.componentInstance.selectCity('city-1');
    expect(zones).toHaveBeenCalledWith();
    expect(fixture.componentInstance.selectedCityId()).toBeNull();
  });
});
