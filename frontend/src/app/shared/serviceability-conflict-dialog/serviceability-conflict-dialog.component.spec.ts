import { TestBed } from '@angular/core/testing';
import {
  ServiceabilityConflictDialogComponent,
  ServiceabilityConflictAction,
} from './serviceability-conflict-dialog.component';

describe('ServiceabilityConflictDialogComponent', () => {
  let closedWith: ServiceabilityConflictAction | undefined;

  function setup() {
    closedWith = undefined;
    TestBed.configureTestingModule({
      imports: [ServiceabilityConflictDialogComponent],
    });
    const fixture = TestBed.createComponent(ServiceabilityConflictDialogComponent);
    fixture.componentInstance.data = {
      lines: [{ productId: 1, retailerId: 'r1', serviceable: false, reasonCode: 'OUT_OF_RANGE', deliveryCharge: null, estimate: null }],
      productNames: { 1: 'Rice 5kg' },
    };
    fixture.componentInstance.closed.subscribe((action) => (closedWith = action));
    fixture.detectChanges();
    return fixture;
  }

  it('falls back to a generic label for a product not in productNames', () => {
    const fixture = setup();
    expect(fixture.componentInstance.nameFor(999)).toBe('Product #999');
    expect(fixture.componentInstance.nameFor(1)).toBe('Rice 5kg');
  });

  it('closes with a try-another-shop action carrying the product id', () => {
    const fixture = setup();
    fixture.componentInstance.tryAnotherShop(1);
    expect(closedWith).toEqual({ type: 'try-another-shop', productId: 1 });
  });

  it('closes with a remove action carrying the product id', () => {
    const fixture = setup();
    fixture.componentInstance.remove(1);
    expect(closedWith).toEqual({ type: 'remove', productId: 1 });
  });

  it('closes with a change-address action', () => {
    const fixture = setup();
    fixture.componentInstance.changeAddress();
    expect(closedWith).toEqual({ type: 'change-address' });
  });
});
