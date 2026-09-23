import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { OrderStatusStepperComponent } from './order-status-stepper.component';
import { OrderTrackingStep } from '../../core/models/order.model';

describe('OrderStatusStepperComponent', () => {
  const steps: OrderTrackingStep[] = [
    { key: 'ORDER_PLACED', label: 'Order Placed', state: 'DONE', reachedAt: null },
    { key: 'WAITING_FOR_RETAILER', label: 'Waiting for Retailer', state: 'CURRENT', reachedAt: null },
    { key: 'RETAILER_ACCEPTED', label: 'Retailer Accepted', state: 'PENDING', reachedAt: null },
  ];

  it('renders every step label in order', async () => {
    await TestBed.configureTestingModule({ imports: [OrderStatusStepperComponent] }).compileComponents();
    const fixture = TestBed.createComponent(OrderStatusStepperComponent);
    fixture.componentInstance.steps = steps;
    fixture.detectChanges();

    const labels = fixture.debugElement
      .queryAll(By.css('.step-label'))
      .map((el) => el.nativeElement.textContent.trim());
    expect(labels).toEqual(['Order Placed', 'Waiting for Retailer', 'Retailer Accepted']);
  });

  it('marks the current step distinctly from done/pending', async () => {
    await TestBed.configureTestingModule({ imports: [OrderStatusStepperComponent] }).compileComponents();
    const fixture = TestBed.createComponent(OrderStatusStepperComponent);
    fixture.componentInstance.steps = steps;
    fixture.detectChanges();

    const current = fixture.debugElement.query(By.css('.state-current'));
    expect(current.nativeElement.textContent).toContain('Waiting for Retailer');
  });

  it('renders a halted banner instead of the stepper when haltedState is set', async () => {
    await TestBed.configureTestingModule({ imports: [OrderStatusStepperComponent] }).compileComponents();
    const fixture = TestBed.createComponent(OrderStatusStepperComponent);
    fixture.componentInstance.steps = null;
    fixture.componentInstance.haltedState = 'RETAILER_REJECTED';
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.stepper'))).toBeNull();
    const banner = fixture.debugElement.query(By.css('.halted-title'));
    expect(banner.nativeElement.textContent).toContain('rejected by the shop');
  });
});
