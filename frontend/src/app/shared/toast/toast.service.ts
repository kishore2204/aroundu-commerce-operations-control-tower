import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  text: string;
  variant: 'info' | 'success' | 'error' | 'warning';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly toast = signal<ToastMessage | null>(null);

  /**
   * `durationMs` defaults longer for 'error'/'warning' than for 'info'/'success' - a failure or a
   * caution needs more time to read than a quick confirmation. A duration is never so short that
   * it could dismiss before a user has had a reasonable chance to read it; toasts are for
   * non-blocking outcomes only - a decision that needs the user's confirmation belongs in a dialog,
   * never a toast (see ConfirmDialogComponent).
   */
  show(text: string, variant: ToastMessage['variant'] = 'info', durationMs?: number): void {
    const id = ++this.nextId;
    const duration = durationMs ?? (variant === 'error' || variant === 'warning' ? 5000 : 3000);
    this.toast.set({ id, text, variant });
    setTimeout(() => {
      if (this.toast()?.id === id) {
        this.toast.set(null);
      }
    }, duration);
  }

  /** Dismisses the current toast immediately, if any - used by the toast's own close button. */
  dismiss(): void {
    this.toast.set(null);
  }

  open(text: string, _action?: string, config?: { duration?: number }): void {
    this.show(text, 'info', config?.duration ?? 3000);
  }
}
