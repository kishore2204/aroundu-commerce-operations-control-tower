import { DatePipe } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnInit, Output, signal } from '@angular/core';
import { VerificationDocumentService } from '../../core/services/verification-document.service';
import { DocumentVersion, documentStatusBadgeClass, documentStatusLabel } from '../../core/models/verification.model';
import { extractErrorMessage } from '../../core/api/http-error.util';

/**
 * "View Document History" - every version of ONE document (v1, v2, v3...), newest first, with who
 * uploaded it, its status, who reviewed it and the reviewer's note. Older versions stay viewable and
 * downloadable through the same file endpoint the current version uses. Read-only: versions are never
 * edited or removed.
 */
@Component({
  selector: 'app-document-history-dialog',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div class="card flex max-h-[90vh] w-full max-w-5xl flex-col" role="dialog" aria-modal="true" aria-labelledby="doc-history-title">
        <div class="flex items-start justify-between gap-3">
          <h2 id="doc-history-title" class="m-0 text-lg font-bold text-slate-900">{{ label }} - Document History</h2>
          <button type="button" class="btn-icon !h-8 !w-8 shrink-0" aria-label="Close" (click)="closed.emit()"><i class="fa-solid fa-xmark"></i></button>
        </div>

        @if (loading()) {
          <div class="flex justify-center py-10"><span class="spinner"></span></div>
        } @else if (error()) {
          <p class="mt-4 text-sm font-semibold text-rose-600">{{ error() }}</p>
        } @else if (versions().length === 0) {
          <p class="mt-4 text-sm text-slate-500">No file has been uploaded for this document yet.</p>
        } @else {
          <div class="table-card mt-4 overflow-auto">
            <table class="custom-table">
              <thead>
                <tr><th>Version</th><th>Uploaded</th><th>Uploaded by</th><th>Status</th><th>Reviewed by</th><th>Reviewer comment / re-upload reason</th><th></th></tr>
              </thead>
              <tbody>
                @for (v of versions(); track v.documentId) {
                  <tr>
                    <td class="font-semibold text-slate-800">v{{ v.versionNumber }}@if (v.isCurrentVersion) { <span class="ml-1 text-xs font-medium text-slate-400">(current)</span> }</td>
                    <td class="whitespace-nowrap text-slate-600">{{ v.uploadedAt | date: 'medium' }}</td>
                    <td>{{ v.uploadedByName || '-' }}</td>
                    <td><span class="badge" [class]="badgeClass(v.documentStatus)">{{ statusLabel(v.documentStatus) }}</span></td>
                    <td>{{ v.reviewerName || 'Pending' }}@if (v.reviewedAt) { <span class="block text-xs text-slate-400">{{ v.reviewedAt | date: 'medium' }}</span> }</td>
                    <td class="max-w-xs text-sm text-slate-600">{{ v.reuploadReason || v.reviewerComment || '-' }}</td>
                    <td class="whitespace-nowrap">
                      <button type="button" class="btn-outline !px-2 !py-1 text-xs" [disabled]="busyId() === v.documentId" (click)="open(v, false)"><i class="fa-solid fa-eye"></i> View</button>
                      <button type="button" class="btn-outline !px-2 !py-1 text-xs" [disabled]="busyId() === v.documentId" (click)="open(v, true)"><i class="fa-solid fa-file-arrow-down"></i> Download</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (fileError()) { <p class="mt-3 text-sm font-semibold text-rose-600">{{ fileError() }}</p> }
        }
      </div>
    </div>
  `,
})
export class DocumentHistoryDialogComponent implements OnInit {
  @Input({ required: true }) queueId!: string;
  /** Stored document type, e.g. GST_CERTIFICATE. */
  @Input({ required: true }) documentType!: string;
  /** Readable name shown in the title, e.g. "GST Certificate". */
  @Input({ required: true }) label!: string;
  @Output() readonly closed = new EventEmitter<void>();

  readonly versions = signal<DocumentVersion[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly fileError = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);

  readonly statusLabel = documentStatusLabel;
  readonly badgeClass = documentStatusBadgeClass;

  constructor(private readonly documents: VerificationDocumentService) {}

  ngOnInit(): void {
    this.documents.history(this.queueId, this.documentType).subscribe({
      next: (versions) => { this.versions.set(versions); this.loading.set(false); },
      error: (err) => { this.error.set(extractErrorMessage(err, 'Could not load the document history.')); this.loading.set(false); },
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }

  /** Fetched through HttpClient (not a plain link) so the auth interceptor attaches the JWT. */
  open(version: DocumentVersion, download: boolean): void {
    this.busyId.set(version.documentId);
    this.fileError.set(null);
    this.documents.fileBlob(version.documentId).subscribe({
      next: (blob) => {
        this.busyId.set(null);
        const url = URL.createObjectURL(blob);
        if (download) {
          const link = document.createElement('a');
          link.href = url;
          link.download = version.fileName || `${this.documentType}-v${version.versionNumber}`;
          link.click();
        } else {
          window.open(url, '_blank', 'noopener');
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => { this.busyId.set(null); this.fileError.set(`Could not load version ${version.versionNumber}.`); },
    });
  }
}
