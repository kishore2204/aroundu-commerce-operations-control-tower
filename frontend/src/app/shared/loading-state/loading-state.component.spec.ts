import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LoadingStateComponent } from './loading-state.component';

describe('LoadingStateComponent', () => {
  it('renders the default message', async () => {
    await TestBed.configureTestingModule({ imports: [LoadingStateComponent] }).compileComponents();
    const fixture = TestBed.createComponent(LoadingStateComponent);
    fixture.detectChanges();

    const message = fixture.debugElement.query(By.css('.message'));
    expect(message.nativeElement.textContent).toContain('Loading...');
  });

  it('renders a custom message when provided', async () => {
    await TestBed.configureTestingModule({ imports: [LoadingStateComponent] }).compileComponents();
    const fixture = TestBed.createComponent(LoadingStateComponent);
    fixture.componentInstance.message = 'Fetching orders...';
    fixture.detectChanges();

    const message = fixture.debugElement.query(By.css('.message'));
    expect(message.nativeElement.textContent).toContain('Fetching orders...');
  });

  it('omits the message paragraph when message is empty', async () => {
    await TestBed.configureTestingModule({ imports: [LoadingStateComponent] }).compileComponents();
    const fixture = TestBed.createComponent(LoadingStateComponent);
    fixture.componentInstance.message = '';
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.message'))).toBeNull();
  });
});
