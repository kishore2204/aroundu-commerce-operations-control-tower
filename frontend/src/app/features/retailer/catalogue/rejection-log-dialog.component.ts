import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { BulkRejectedRow } from '../../../core/models/bulk-upload.model';

/**
 * "Rejected Product Log" - the rows of a bulk upload that were not applied, as a table that shows EXACTLY what the
 * rejected-products XLSX / CSV contains: the same columns (every upload column, then Error) and the same values,
 * read from the same rejected rows the reports are built from - nothing is added, dropped or reworded here.
 *
 * The table area scrolls on its own, in both directions (the popup and the page behind it stay put), and the header
 * row stays visible while the rows scroll. A cell the upload was rejected for is marked red, like in the XLSX.
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
              {{ rows.length }} rejected {{ rows.length === 1 ? 'row' : 'rows' }} - the same content as the downloadable rejected file.
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
                  class="sticky top-0 z-10 min-w-[24rem] whitespace-nowrap border-b border-slate-200 bg-slate-100 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600 last:rounded-tr-lg"
                >
                  Error
                </th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows; track row.rowNumber) {
                <tr class="odd:bg-white even:bg-slate-50/60">
                  @for (column of columns; track column) {
                    <td
                      class="max-w-[22rem] whitespace-pre-wrap break-words border-b border-slate-100 px-3 py-2 align-top text-slate-800"
                      [class.!bg-rose-50]="isFlagged(row, column)"
                      [class.!text-rose-700]="isFlagged(row, column)"
                      [class.font-semibold]="isFlagged(row, column)"
                    >{{ row.values[column] }}</td>
                  }
                  <td class="min-w-[24rem] whitespace-pre-wrap break-words border-b border-slate-100 px-3 py-2 align-top font-medium text-rose-700">{{ row.error }}</td>
                </tr>
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
  private rowsValue: BulkRejectedRow[] = [];
  /** The upload columns, in the order the reports use: the keys of the rows' original values (first seen first). */
  columns: string[] = [];

  /** The rejected rows exactly as the upload returned them (the rows the XLSX and CSV are made from). */
  @Input({ required: true })
  set rows(value: BulkRejectedRow[]) {
    this.rowsValue = value ?? [];
    const seen = new Set<string>();
    for (const row of this.rowsValue) {
      for (const column of Object.keys(row.values ?? {})) seen.add(column);
    }
    this.columns = [...seen];
  }
  get rows(): BulkRejectedRow[] {
    return this.rowsValue;
  }

  @Output() readonly closed = new EventEmitter<void>();

  isFlagged(row: BulkRejectedRow, column: string): boolean {
    return (row.errorFields ?? []).includes(column);
  }
}
