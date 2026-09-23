import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { AdminStatesComponent } from './states.component';
import { StateService } from '../../../core/services/state.service';
import { State } from '../../../core/models/state.model';

describe('AdminStatesComponent', () => {
  const state: State = { id: 's1', stateName: 'Karnataka', countryCode: 'IN', isActive: true };

  function setup(serviceSpy: Partial<StateService>) {
    TestBed.configureTestingModule({
      imports: [AdminStatesComponent],
      providers: [{ provide: StateService, useValue: serviceSpy }],
    });
    return TestBed.createComponent(AdminStatesComponent);
  }

  it('should create', () => {
    const fixture = setup({ all: () => of([]) });
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads states sorted by name on init and renders rows', () => {
    const tamil: State = { id: 's2', stateName: 'Tamil Nadu', countryCode: 'IN', isActive: false };
    const all = jasmine.createSpy().and.returnValue(of([tamil, state]));
    const fixture = setup({ all });
    fixture.detectChanges();

    expect(all).toHaveBeenCalled();
    expect(fixture.componentInstance.states().map((s) => s.stateName)).toEqual(['Karnataka', 'Tamil Nadu']);
    expect(fixture.debugElement.queryAll(By.css('li')).length).toBe(2);
  });

  it('creates a new state and reloads on success', () => {
    const all = jasmine.createSpy().and.returnValue(of([state]));
    const create = jasmine.createSpy().and.returnValue(of(state));
    const fixture = setup({ all, create });
    fixture.detectChanges();

    fixture.componentInstance.showForm.set(true);
    fixture.componentInstance.form.setValue({ stateName: 'Karnataka', countryCode: 'IN' });
    fixture.componentInstance.save();

    expect(create).toHaveBeenCalledWith({ stateName: 'Karnataka', countryCode: 'IN', isActive: true });
    expect(fixture.componentInstance.showForm()).toBeFalse();
    expect(all).toHaveBeenCalledTimes(2);
  });

  it('toggles a state active flag via update and reloads on success', () => {
    const all = jasmine.createSpy().and.returnValue(of([state]));
    const update = jasmine.createSpy().and.returnValue(of({ ...state, isActive: false }));
    const fixture = setup({ all, update });
    fixture.detectChanges();

    fixture.componentInstance.toggle(state);

    expect(update).toHaveBeenCalledWith('s1', { stateName: 'Karnataka', countryCode: 'IN', isActive: false });
    expect(all).toHaveBeenCalledTimes(2);
  });
});
