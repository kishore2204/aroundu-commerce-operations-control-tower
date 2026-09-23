import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { UnavailableComponent } from './unavailable.component';

describe('UnavailableComponent', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [UnavailableComponent],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(UnavailableComponent);
    fixture.detectChanges();
    return { fixture };
  }

  it('creates', () => {
    const { fixture } = setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows the empty-state message explaining the account restriction', () => {
    const { fixture } = setup();
    const emptyState = fixture.debugElement.query(By.css('app-empty-state'));
    expect(emptyState).not.toBeNull();
    expect(emptyState.componentInstance.title).toBe('Not available for your account yet');
  });

  it('links back to the sign-in page', () => {
    const { fixture } = setup();
    const link = fixture.debugElement.query(By.css('a[routerLink="/login"]'));
    expect(link).not.toBeNull();
    expect(link.nativeElement.textContent).toContain('Back to sign in');
  });
});
