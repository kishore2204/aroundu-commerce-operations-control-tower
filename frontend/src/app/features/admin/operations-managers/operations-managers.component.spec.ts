import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { AdminOperationsManagersComponent } from './operations-managers.component';
import { OperationsManagerService } from '../../../core/services/operations-manager.service';
import { UserAccountService } from '../../../core/services/user-account.service';
import { TerritoryService } from '../../../core/services/territory.service';
import { OperationsManagerAssignment, OperationsManagerSummary } from '../../../core/models/operations-manager.model';

describe('AdminOperationsManagersComponent', () => {
  const manager: OperationsManagerAssignment = {
    id: 'm1',
    userAccountId: 'u1',
    displayName: 'Om Manager',
    email: 'om@example.com',
    cityId: 'c1',
    cityName: 'Chennai',
    assignmentStatus: 'ACTIVE',
    assignedAt: '2024-01-01T00:00:00Z',
    updatedAt: null,
    version: 1,
  };

  const summary: OperationsManagerSummary = { total: 4, active: 2, inactive: 1, suspended: 1, transferred: 0 };

  function setup(serviceSpy: Partial<OperationsManagerService>) {
    TestBed.configureTestingModule({
      imports: [AdminOperationsManagersComponent],
      providers: [
        { provide: OperationsManagerService, useValue: serviceSpy },
        { provide: UserAccountService, useValue: { byRole: () => of([]) } },
        { provide: TerritoryService, useValue: { cities: () => of({ content: [], totalElements: 0, totalPages: 0, size: 100, number: 0 }) } },
      ],
    });
    return TestBed.createComponent(AdminOperationsManagersComponent);
  }

  it('should create', () => {
    const fixture = setup({ search: () => of({ content: [], totalElements: 0, totalPages: 0, size: 100, number: 0 }), summary: () => of(summary) });
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads the summary and manager list on init and renders rows', () => {
    const list = jasmine
      .createSpy()
      .and.returnValue(of({ content: [manager], totalElements: 1, totalPages: 1, size: 100, number: 0 }));
    const fixture = setup({ search: list, summary: () => of(summary) });
    fixture.detectChanges();

    expect(list).toHaveBeenCalledWith(jasmine.objectContaining({ q: '', status: '', cityId: '', page: 0 }));
    expect(fixture.componentInstance.managers()).toEqual([manager]);
    expect(fixture.componentInstance.summary()).toEqual(summary);
    expect(fixture.debugElement.queryAll(By.css('li')).length).toBe(1);
  });

  it('creates a new assignment and reloads on success', () => {
    const list = jasmine
      .createSpy()
      .and.returnValue(of({ content: [manager], totalElements: 1, totalPages: 1, size: 100, number: 0 }));
    const create = jasmine.createSpy().and.returnValue(of(manager));
    const fixture = setup({ search: list, summary: () => of(summary), create });
    fixture.detectChanges();

    fixture.componentInstance.showForm.set(true);
    fixture.componentInstance.form.setValue({ userAccountId: 'u1', cityId: 'c1' });
    fixture.componentInstance.save();

    expect(create).toHaveBeenCalledWith({ userAccountId: 'u1', cityId: 'c1' });
    expect(fixture.componentInstance.showForm()).toBeFalse();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('calls setStatus with the toggled status and reloads on success', () => {
    const list = jasmine
      .createSpy()
      .and.returnValue(of({ content: [manager], totalElements: 1, totalPages: 1, size: 100, number: 0 }));
    const setStatus = jasmine.createSpy().and.returnValue(of({ ...manager, assignmentStatus: 'INACTIVE' }));
    const fixture = setup({ search: list, summary: () => of(summary), setStatus });
    fixture.detectChanges();

    fixture.componentInstance.setStatus(manager, 'INACTIVE');

    expect(setStatus).toHaveBeenCalledWith('m1', 'INACTIVE');
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('filters on the server: status, city and search are sent together and paging restarts at the first page', () => {
    const list = jasmine
      .createSpy()
      .and.returnValue(of({ content: [manager], totalElements: 25, totalPages: 3, size: 10, number: 0 }));
    const fixture = setup({ search: list, summary: () => of(summary) });
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.goToPage(2);
    expect(list).toHaveBeenCalledWith(jasmine.objectContaining({ page: 2 }));

    component.setStatusFilter('SUSPENDED');
    component.setCityFilter('c1');
    expect(list.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ status: 'SUSPENDED', cityId: 'c1', page: 0 }));
    expect(component.hasFilters()).toBeTrue();

    component.clearFilters();
    expect(list.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ status: '', cityId: '', q: '', page: 0 }));
    expect(component.hasFilters()).toBeFalse();
  });

  it('sorts by the clicked column and flips the direction on a second click', () => {
    const list = jasmine
      .createSpy()
      .and.returnValue(of({ content: [manager], totalElements: 1, totalPages: 1, size: 10, number: 0 }));
    const fixture = setup({ search: list, summary: () => of(summary) });
    fixture.detectChanges();

    fixture.componentInstance.sortBy('city.cityName');
    expect(list.calls.mostRecent().args[0].sort).toBe('city.cityName,asc');
    fixture.componentInstance.sortBy('city.cityName');
    expect(list.calls.mostRecent().args[0].sort).toBe('city.cityName,desc');
  });
});
