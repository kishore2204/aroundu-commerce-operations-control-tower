import { Component, ElementRef, Input, OnChanges, inject } from '@angular/core';
import { OrderTrackingStep } from '../../core/models/order.model';

/** Human-facing copy for each halted state - see OrderTracking.haltedState. */
const HALTED_COPY: Record<string, { title: string; message: string }> = {
  RETAILER_REJECTED: {
    title: 'Your order was rejected by the shop.',
    message: 'Find another shop where this product is available and continue your order there.',
  },
  SHOP_UNAVAILABLE: {
    title: 'The shop did not respond to your order.',
    message: 'Please find another shop for this product.',
  },
  CANCELLED: {
    title: 'This order was cancelled.',
    message: '',
  },
};

@Component({
  selector: 'app-order-status-stepper',
  standalone: true,
  imports: [],
  templateUrl: './order-status-stepper.component.html',
  styleUrl: './order-status-stepper.component.css',
})
export class OrderStatusStepperComponent implements OnChanges {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private lastCurrentKey: string | null = null;

  /** Null when the order is halted - see haltedState. Read fresh from the backend on every
   * poll; never inferred client-side (requirement: "frontend should not assume a stage is
   * completed without the corresponding backend status update"). */
  @Input() steps: OrderTrackingStep[] | null = null;
  @Input() haltedState: string | null = null;

  /** When the tracker is wider than its container (it scrolls sideways), bring the current stage
   *  into view - but only when the stage itself changes, so the 5-second refresh never fights a
   *  customer who is scrolling it by hand. */
  ngOnChanges(): void {
    const currentKey = this.steps?.find((step) => step.state === 'CURRENT')?.key ?? null;
    if (!currentKey || currentKey === this.lastCurrentKey) return;
    this.lastCurrentKey = currentKey;
    setTimeout(() => {
      const container = this.host.nativeElement.querySelector<HTMLElement>('.stepper-scroll');
      const current = container?.querySelector<HTMLElement>('.state-current');
      if (!container || !current || container.scrollWidth <= container.clientWidth) return;
      container.scrollLeft = current.offsetLeft - (container.clientWidth - current.offsetWidth) / 2;
    });
  }

  get haltedCopy(): { title: string; message: string } | null {
    return this.haltedState ? (HALTED_COPY[this.haltedState] ?? { title: this.haltedState, message: '' }) : null;
  }

  iconFor(state: OrderTrackingStep['state']): string {
    switch (state) {
      case 'DONE':
        return 'fa-circle-check';
      case 'CURRENT':
        return 'fa-circle-dot';
      case 'FAILED':
        return 'fa-circle-xmark';
      default:
        return 'fa-circle';
    }
  }
}
