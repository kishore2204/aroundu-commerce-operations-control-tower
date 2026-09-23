import { Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
import { BulkConflict, BulkDecision } from '../../../core/models/bulk-upload.model';

/**
 * "Existing Products Detected" - shown after a bulk upload has been parsed when one or more
 * uploaded SKUs already exist in the retailer's catalogue with different data. ONE dialog lists
 * every such product with what differs, and the retailer must choose an action for each one - no
 * action is pre-selected, so nothing is ever overwritten silently. Cancelling (button, X or Esc)
 * emits `cancelled` and nothing has been changed; backdrop clicks deliberately do nothing.
 */
@Component({
  selector: 'app-bulk-conflict-dialog',
  standalone: true,
  imports: [],
  templateUrl: './bulk-conflict-dialog.component.html',
})
export class BulkConflictDialogComponent {
  @Input({ required: true }) conflicts: BulkConflict[] = [];
  /** True while the chosen actions are being applied - locks the dialog. */
  @Input() busy = false;
  /** SKU -> chosen action, emitted once every conflict has an explicit choice. */
  @Output() readonly confirmed = new EventEmitter<Record<string, BulkDecision>>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly options: { value: BulkDecision; label: string; hint: string }[] = [
    { value: 'KEEP', label: 'Keep Existing', hint: 'Ignore the uploaded changes' },
    { value: 'UPDATE', label: 'Update Existing', hint: 'Apply the uploaded values' },
    { value: 'SKIP', label: 'Skip', hint: 'Do not process; listed as rejected' },
  ];

  readonly choices = signal<Record<string, BulkDecision>>({});
  readonly attemptedContinue = signal(false);

  unresolvedCount(): number {
    return this.conflicts.filter((conflict) => !this.choices()[conflict.sku]).length;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel();
  }

  choose(sku: string, decision: BulkDecision): void {
    this.choices.update((choices) => ({ ...choices, [sku]: decision }));
  }

  isUnresolved(sku: string): boolean {
    return this.attemptedContinue() && !this.choices()[sku];
  }

  continue(): void {
    if (this.busy) return;
    if (this.unresolvedCount() > 0) {
      this.attemptedContinue.set(true);
      return;
    }
    this.confirmed.emit(this.choices());
  }

  cancel(): void {
    if (!this.busy) this.cancelled.emit();
  }

  /** Price differences are shown as money; every other field as entered. */
  display(field: string, value: string | null): string {
    if (value == null || value === '') return '-';
    return field === 'Price' ? '₹' + value : value;
  }
}
