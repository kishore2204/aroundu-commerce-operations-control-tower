import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

/**
 * The single toast surface for the whole app (mounted once in each portal's shell). `role` and
 * `aria-live` make a screen reader announce a new toast without needing to have focus on it;
 * "assertive" for error/warning (interrupts, since it's a failure/caution worth an immediate
 * announcement) and "polite" otherwise (waits its turn, for a success/info confirmation). An icon
 * carries the same meaning as the colour, and a close button lets a user dismiss - or keep reading
 * past - the auto-dismiss timer.
 */
@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    @if (toast.toast(); as t) {
      <div
        class="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 flex items-center gap-3 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-card-hover animate-fade-in"
        [class.bg-slate-900]="t.variant === 'info'"
        [class.bg-zgreen-500]="t.variant === 'success'"
        [class.bg-rose-600]="t.variant === 'error'"
        [class.bg-amber-500]="t.variant === 'warning'"
        role="status"
        [attr.aria-live]="t.variant === 'error' || t.variant === 'warning' ? 'assertive' : 'polite'"
      >
        <i
          class="fa-solid"
          aria-hidden="true"
          [class.fa-circle-info]="t.variant === 'info'"
          [class.fa-circle-check]="t.variant === 'success'"
          [class.fa-circle-exclamation]="t.variant === 'error'"
          [class.fa-triangle-exclamation]="t.variant === 'warning'"
        ></i>
        <span>{{ t.text }}</span>
        <button type="button" class="ml-1 text-white/80 hover:text-white" (click)="toast.dismiss()" aria-label="Dismiss notification">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
    }
  `,
})
export class ToastComponent {
  readonly toast = inject(ToastService);
}
