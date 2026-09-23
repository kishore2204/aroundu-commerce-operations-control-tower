import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild } from '@angular/core';

/**
 * Generic "are you sure?" confirmation dialog - the one place a destructive/critical action asks
 * the user to confirm, instead of the browser's own unstyled, unlabelled `confirm()` (which cannot
 * show a loading state and looks nothing like the rest of this app).
 *
 * Presentation-only: the caller supplies the wording and listens for `confirmed`/`cancelled`, and
 * keeps `busy` true for as long as its own request is in flight (mirrors WorkTransferDialogComponent) -
 * this dialog never performs the action itself, so opening it can never have a side effect, and
 * closing it (Cancel, Escape, or the backdrop is intentionally NOT clickable while busy) never does either.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div class="card w-full max-w-md" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
        <div class="flex items-start gap-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full" [class.bg-rose-50]="danger" [class.text-rose-600]="danger" [class.bg-amber-50]="!danger" [class.text-amber-600]="!danger">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </span>
          <div class="min-w-0">
            <h2 id="confirm-dialog-title" class="m-0 text-lg font-bold text-slate-900">{{ title }}</h2>
            <p id="confirm-dialog-message" class="m-0 mt-1 text-sm text-slate-600">{{ message }}</p>
          </div>
        </div>
        <div class="mt-5 flex justify-end gap-2">
          <button #cancelButton type="button" class="btn-outline" [disabled]="busy" (click)="cancelled.emit()">{{ cancelLabel }}</button>
          <button type="button" class="btn-primary" [class.!bg-gradient-to-br]="danger" [class.!from-rose-600]="danger" [class.!to-rose-500]="danger"
            [disabled]="busy" (click)="confirmed.emit()">
            @if (busy) {
              <span class="spinner !h-4 !w-4 !border-white/40 !border-t-white"></span> {{ busyLabel }}
            } @else {
              {{ confirmLabel }}
            }
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ConfirmDialogComponent implements AfterViewInit {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) message!: string;
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';
  @Input() busyLabel = 'Processing...';
  /** Destructive/irreversible action - red styling instead of the default primary colour. */
  @Input() danger = false;
  /** True while the caller's own request (started after `confirmed`) is in flight. */
  @Input() busy = false;
  @Output() readonly confirmed = new EventEmitter<void>();
  @Output() readonly cancelled = new EventEmitter<void>();

  @ViewChild('cancelButton') private readonly cancelButton?: ElementRef<HTMLButtonElement>;

  /** Focuses the safe (Cancel) action by default, so a stray Enter key never confirms unintentionally. */
  ngAfterViewInit(): void {
    this.cancelButton?.nativeElement.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.busy) this.cancelled.emit();
  }
}
