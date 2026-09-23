import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [EmptyStateComponent] });
    return TestBed.createComponent(EmptyStateComponent);
  }

  it('should create', () => {
    const fixture = setup();
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('uses default icon and title when no inputs are set', () => {
    const fixture = setup();
    fixture.detectChanges();

    expect(fixture.componentInstance.icon).toBe('inbox');
    expect(fixture.componentInstance.title).toBe('Nothing here yet');
    expect(fixture.debugElement.query(By.css('.title')).nativeElement.textContent).toContain('Nothing here yet');
    expect(fixture.debugElement.query(By.css('.subtitle'))).toBeNull();
  });

  it('renders the subtitle when provided', () => {
    const fixture = setup();
    fixture.componentInstance.icon = 'group';
    fixture.componentInstance.title = 'No accounts found';
    fixture.componentInstance.subtitle = 'Try adjusting your search';
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.icon')).nativeElement.className).toContain('fa-users');
    expect(fixture.debugElement.query(By.css('.subtitle')).nativeElement.textContent).toContain(
      'Try adjusting your search',
    );
  });
});
