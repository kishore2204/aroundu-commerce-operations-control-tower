import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CatalogueService } from '../../../core/services/catalogue.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { BulkConflict, BulkDecision, BulkRejectedRow } from '../../../core/models/bulk-upload.model';

/** What one Save / Delete in the log changed: the rejected rows that are left, and what a saved row turned into. */
export interface RejectionLogChange {
  rows: BulkRejectedRow[];
  created: number;
  updated: number;
  unchanged: number;
}

/**
 * "Rejected Product Log" - the rows of a bulk upload that were not applied, as a table that shows EXACTLY what the
 * rejected-products XLSX / CSV contains: the same columns (every upload column, then Error) and the same values,
 * read from the same rejected rows the reports are built from - nothing is added, dropped or reworded here.
 *
 * Each row has its own actions:
 *  - Edit   makes the cells of that row editable (a cell the upload was rejected for is marked red);
 *  - Save   sends the corrected row through the SAME bulk-upload endpoint as a one-row file, so every rule of the normal
 *           upload applies (nothing is skipped or added for this path). If it is accepted the row leaves the log; if it is
 *           rejected again the log shows the new reason and the row stays in edit mode. A SKU that already exists with
 *           different data is never overwritten silently - the row shows the differences and asks first;
 *  - Delete removes the row from the log (nothing was ever saved for it, so no product is touched).
 *
 * The table area scrolls on its own, in both directions (the popup and the page behind it stay put), and the header
 * row stays visible while the rows scroll.
 */
@Component({
  selector: 'app-rejection-log-dialog',
  standalone: true,
  imports: [],
  template: `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4" (click)="closed.emit()">
      <div
        class="card flex max-h-[90vh] w-full max-w-6xl flex-col !p-0"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rejection-log-title"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="rejection-log-title" class="m-0 text-lg font-bold text-slate-900">Rejected Product Log</h2>
            <p class="m-0 mt-0.5 text-sm text-slate-500">
              {{ rows.length }} rejected {{ rows.length === 1 ? 'row' : 'rows' }}. Edit a row and Save to add it, or Delete to drop it from this list.
            </p>
          </div>
          <button type="button" class="btn-icon !h-8 !w-8 shrink-0" aria-label="Close rejection log" (click)="closed.emit()">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-auto px-5 pb-4" tabindex="0" role="region" aria-label="Rejected products table">
          <table class="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                @for (column of columns; track column) {
                  <th
                    scope="col"
                    class="sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-100 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600 first:rounded-tl-lg"
                  >
                    {{ column }}
                  </th>
                }
                <th
                  scope="col"
                  class="sticky top-0 z-10 min-w-[24rem] whitespace-nowrap border-b border-slate-200 bg-slate-100 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600"
                >
                  Error
                </th>
                <th
                  scope="col"
                  class="sticky right-0 top-0 z-20 whitespace-nowrap border-b border-l border-slate-200 bg-slate-100 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600 last:rounded-tr-lg"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows; track row.rowNumber) {
                <tr class="rejected-row odd:bg-white even:bg-slate-50/60" [attr.data-row]="row.rowNumber">
                  @for (column of columns; track column) {
                    @if (editing() === row.rowNumber) {
                      <td
                        class="border-b border-slate-100 px-2 py-1.5 align-top"
                        [class.!bg-rose-50]="isFlagged(row, column)"
                      >
                        <input
                          type="text"
                          class="input !min-w-[8rem] !px-2 !py-1 text-sm"
                          [class.!border-rose-400]="isFlagged(row, column)"
                          [attr.aria-label]="column"
                          [value]="draft()[column] ?? ''"
                          (input)="setDraft(column, $any($event.target).value)"
                        />
                      </td>
                    } @else {
                      <td
                        class="max-w-[22rem] whitespace-pre-wrap break-words border-b border-slate-100 px-3 py-2 align-top text-slate-800"
                        [class.!bg-rose-50]="isFlagged(row, column)"
                        [class.!text-rose-700]="isFlagged(row, column)"
                        [class.font-semibold]="isFlagged(row, column)"
                      >{{ row.values[column] }}</td>
                    }
                  }
                  <td class="min-w-[24rem] whitespace-pre-wrap break-words border-b border-slate-100 px-3 py-2 align-top font-medium text-rose-700">{{ row.error }}</td>
                  <td class="sticky right-0 z-[5] whitespace-nowrap border-b border-l border-slate-100 bg-white px-3 py-2 align-top">
                    <div class="flex items-center gap-1.5">
                      @if (editing() === row.rowNumber) {
                        <button type="button" class="save-row btn-primary !px-2.5 !py-1 !text-xs" [disabled]="saving()" (click)="save(row)">
                          @if (saving()) { <span class="spinner !h-3 !w-3"></span> } @else { <i class="fa-solid fa-floppy-disk"></i> }
                          Save
                        </button>
                        <button type="button" class="cancel-edit btn-outline !px-2.5 !py-1 !text-xs" [disabled]="saving()" (click)="cancelEdit()">Cancel</button>
                      } @else {
                        <button type="button" class="edit-row btn-outline !px-2.5 !py-1 !text-xs" [disabled]="saving()" (click)="edit(row)">
                          <i class="fa-solid fa-pen"></i> Edit
                        </button>
                      }
                      <button
                        type="button"
                        class="delete-row btn-outline !border-rose-300 !px-2.5 !py-1 !text-xs !text-rose-600 hover:!bg-rose-50"
                        [disabled]="saving()"
                        [attr.aria-label]="'Delete rejected row ' + row.rowNumber"
                        (click)="remove(row)"
                      >
                        <i class="fa-solid fa-trash-can"></i> Delete
                      </button>
                    </div>
                  </td>
                </tr>
                @if (notice(); as n) {
                  @if (n.rowNumber === row.rowNumber) {
                    <tr>
                      <td [attr.colspan]="columns.length + 2" class="border-b border-slate-100 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{{ n.message }}</td>
                    </tr>
                  }
                }
                @if (conflict(); as c) {
                  @if (c.rowNumber === row.rowNumber) {
                    <tr class="existing-product-conflict">
                      <td [attr.colspan]="columns.length + 2" class="border-b border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                        <p class="m-0 font-semibold">A product with SKU {{ c.conflict.sku }} ({{ c.conflict.existingName }}) already exists with different data. Saving will update it:</p>
                        <ul class="m-0 mt-1 list-disc pl-5">
                          @for (change of c.conflict.changes; track change.field) {
                            <li>{{ change.field }}: {{ change.existing || '(empty)' }} -> {{ change.uploaded || '(empty)' }}</li>
                          }
                        </ul>
                        <div class="mt-2 flex gap-2">
                          <button type="button" class="update-existing btn-primary !px-2.5 !py-1 !text-xs" [disabled]="saving()" (click)="save(row, 'UPDATE')">Update the existing product</button>
                          <button type="button" class="btn-outline !px-2.5 !py-1 !text-xs" [disabled]="saving()" (click)="conflict.set(null)">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  }
                }
              }
            </tbody>
          </table>
        </div>

        <div class="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <span class="hidden text-xs text-slate-400 sm:inline">Scroll the table to see every column and row.</span>
          <button type="button" class="btn-primary ml-auto" (click)="closed.emit()">Close</button>
        </div>
      </div>
    </div>
  `,
})
export class RejectionLogDialogComponent {
  private readonly catalogueService = inject(CatalogueService);

  private rowsValue: BulkRejectedRow[] = [];
  /** The upload columns, in the order the reports use: the keys of the rows' original values (first seen first). */
  columns: string[] = [];

  /** The rejected rows exactly as the upload returned them (the rows the XLSX and CSV are made from). */
  @Input({ required: true })
  set rows(value: BulkRejectedRow[]) {
    this.rowsValue = value ?? [];
    const seen = new Set<string>(this.columns);
    for (const row of this.rowsValue) {
      for (const column of Object.keys(row.values ?? {})) seen.add(column);
    }
    this.columns = [...seen];
  }
  get rows(): BulkRejectedRow[] {
    return this.rowsValue;
  }

  @Output() readonly closed = new EventEmitter<void>();
  /** A row was saved (it leaves the log), rejected again (new reason) or deleted. */
  @Output() readonly changed = new EventEmitter<RejectionLogChange>();

  /** The row being edited (one at a time) and its working copy of the cells. */
  readonly editing = signal<number | null>(null);
  readonly draft = signal<Record<string, string>>({});
  readonly saving = signal(false);
  /** A message under the row it belongs to (a failed request). */
  readonly notice = signal<{ rowNumber: number; message: string } | null>(null);
  /** The row's SKU exists already with different data: the differences, waiting for a yes. */
  readonly conflict = signal<{ rowNumber: number; conflict: BulkConflict } | null>(null);

  isFlagged(row: BulkRejectedRow, column: string): boolean {
    return (row.errorFields ?? []).includes(column);
  }

  edit(row: BulkRejectedRow): void {
    if (this.saving()) return;
    this.editing.set(row.rowNumber);
    this.draft.set({ ...row.values });
    this.notice.set(null);
    this.conflict.set(null);
  }

  cancelEdit(): void {
    if (this.saving()) return;
    this.editing.set(null);
    this.notice.set(null);
    this.conflict.set(null);
  }

  setDraft(column: string, value: string): void {
    this.draft.update((current) => ({ ...current, [column]: value }));
    // the answer to a previous save no longer describes what is typed
    this.conflict.set(null);
  }

  /** Removes the row from the log only - no product was ever written for a rejected row. */
  remove(row: BulkRejectedRow): void {
    if (this.saving()) return;
    if (this.editing() === row.rowNumber) this.editing.set(null);
    this.notice.set(null);
    this.conflict.set(null);
    this.changed.emit({ rows: this.rows.filter((r) => r.rowNumber !== row.rowNumber), created: 0, updated: 0, unchanged: 0 });
  }

  /** Sends the corrected row as a one-row file through the normal bulk-upload endpoint. */
  save(row: BulkRejectedRow, decision?: BulkDecision): void {
    if (this.saving() || this.editing() !== row.rowNumber) return;
    const values = { ...this.draft() };
    const file = new File([toCsv(this.columns, values)], 'corrected-product.csv', { type: 'text/csv' });
    // the only decision ever sent is the one the retailer just confirmed for THIS row's SKU
    const decisions = decision && this.conflict() ? { [this.conflict()!.conflict.sku]: decision } : undefined;
    this.saving.set(true);
    this.notice.set(null);
    this.catalogueService.bulkUpload(file, decisions).subscribe({
      next: (result) => {
        this.saving.set(false);
        if (result.status === 'NEEDS_DECISIONS' && result.conflicts.length > 0) {
          this.conflict.set({ rowNumber: row.rowNumber, conflict: result.conflicts[0] });
          return;
        }
        this.conflict.set(null);
        if (result.rejected > 0 && result.rejectedRows.length > 0) {
          // still not acceptable: show the new reason next to what was typed, stay in edit mode
          const again = result.rejectedRows[0];
          const updatedRow: BulkRejectedRow = { ...row, values, error: again.error, errorFields: again.errorFields ?? [] };
          this.changed.emit({
            rows: this.rows.map((r) => (r.rowNumber === row.rowNumber ? updatedRow : r)),
            created: 0,
            updated: 0,
            unchanged: 0,
          });
          return;
        }
        this.editing.set(null);
        this.changed.emit({
          rows: this.rows.filter((r) => r.rowNumber !== row.rowNumber),
          created: result.created,
          updated: result.updated,
          unchanged: result.unchanged,
        });
      },
      error: (err) => {
        this.saving.set(false);
        this.notice.set({ rowNumber: row.rowNumber, message: extractErrorMessage(err, 'This row could not be saved. Please try again.') });
      },
    });
  }
}

/** A header row of the upload's column labels and one row of values, every field quoted (commas, quotes, line breaks). */
export function toCsv(columns: string[], values: Record<string, string>): string {
  const field = (text: string) => `"${(text ?? '').replace(/"/g, '""')}"`;
  return `${columns.map(field).join(',')}\r\n${columns.map((column) => field(values[column] ?? '')).join(',')}\r\n`;
}
