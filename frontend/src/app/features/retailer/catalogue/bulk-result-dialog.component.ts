import { Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
import { BulkUploadResult } from '../../../core/models/bulk-upload.model';
import { RejectionLogChange, RejectionLogDialogComponent } from './rejection-log-dialog.component';

/**
 * "Bulk Upload Completed" - the final outcome of an upload, with created / updated / rejected counts
 * and, only when some rows were rejected: a "Rejection Log" (the same rows in a table on screen) and the rejected
 * products as XLSX or CSV (original values + an Error column) so the retailer can correct it and upload it again.
 * With nothing rejected none of those controls exist.
 */
@Component({
  selector: 'app-bulk-result-dialog',
  standalone: true,
  imports: [RejectionLogDialogComponent],
  templateUrl: './bulk-result-dialog.component.html',
})
export class BulkResultDialogComponent {
  @Input({ required: true }) result!: BulkUploadResult;
  /** Which rejected-products file is being prepared right now, if any. */
  @Input() downloading: 'xlsx' | 'csv' | null = null;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly downloadRejected = new EventEmitter<void>();
  @Output() readonly downloadRejectedCsv = new EventEmitter<void>();
  /** The result after a row was saved, deleted or rejected again in the Rejection Log (counts and rejected rows kept in step). */
  @Output() readonly resultChange = new EventEmitter<BulkUploadResult>();

  /** The Rejection Log popup sits on top of this one; closing it leaves this result (and the rejected rows) as they were. */
  readonly logOpen = signal(false);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    // Esc closes the topmost popup only
    if (this.logOpen()) this.logOpen.set(false);
    else this.closed.emit();
  }

  /** A Save / Delete in the log: a saved row moves from "rejected" to created / updated / unchanged, a deleted one just leaves. */
  onLogChanged(change: RejectionLogChange): void {
    this.resultChange.emit({
      ...this.result,
      created: this.result.created + change.created,
      updated: this.result.updated + change.updated,
      unchanged: this.result.unchanged + change.unchanged,
      rejected: change.rows.length,
      rejectedRows: change.rows,
    });
    // nothing left to correct: the log has done its job
    if (change.rows.length === 0) this.logOpen.set(false);
  }

  /** Rows that did not end up rejected: created, updated, or already up to date / kept as is. */
  get succeeded(): number {
    return this.result.created + this.result.updated + this.result.unchanged;
  }

  /** e.g. "8 created, 4 updated, 2 rejected" / "12 created successfully" / "10 updated". */
  get headline(): string {
    const { created, updated, unchanged, rejected } = this.result;
    const parts = [
      created ? `${created} created` : '',
      updated ? `${updated} updated` : '',
      unchanged ? `${unchanged} unchanged` : '',
      rejected ? `${rejected} rejected` : '',
    ].filter(Boolean);
    const text = parts.join(', ');
    return !rejected && created && !updated && !unchanged ? `${text} successfully` : text;
  }

  get summary(): string {
    const { rejected } = this.result;
    const product = (count: number) => (count === 1 ? '1 product' : `${count} products`);
    if (rejected === 0) return `${product(this.succeeded)} processed successfully.`;
    if (this.succeeded === 0) return `0 products processed successfully. ${product(rejected)} ${rejected === 1 ? 'was' : 'were'} rejected.`;
    return `${product(this.succeeded)} ${this.succeeded === 1 ? 'was' : 'were'} processed successfully and ${rejected} ${rejected === 1 ? 'was' : 'were'} rejected.`;
  }
}
