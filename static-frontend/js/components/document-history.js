/*
 * <app-document-history-dialog> - port of shared/document-history/document-history-dialog.component.ts:
 * every version of ONE verification document, newest first, with view / download of each version.
 *
 *   DocumentHistoryDialog({ queueId, documentType, label, onClosed })
 */
(function () {
  function documentStatusLabel(status) {
    switch ((status ?? '').toUpperCase()) {
      case 'APPROVED': return 'Approved';
      case 'REJECTED': return 'Re-upload Required';
      case 'RESUBMITTED': return 'Resubmitted';
      default: return 'Pending Review';
    }
  }
  function documentStatusBadgeClass(status) {
    switch ((status ?? '').toUpperCase()) {
      case 'APPROVED': return 'badge-active';
      case 'REJECTED': return 'badge-danger';
      default: return 'badge-pending';
    }
  }
  window.DocumentStatus = { label: documentStatusLabel, badgeClass: documentStatusBadgeClass };

  window.DocumentHistoryDialog = function (opts) {
    const key = `doc-history-${opts.queueId}-${opts.documentType}`;
    const inst = U.component(key, () => ({
      versions: [], loading: true, error: null, fileError: null, busyId: null,
      init() {
        VerificationDocumentService.history(opts.queueId, opts.documentType).then(
          (versions) => { this.versions = versions; this.loading = false; App.update(); },
          (err) => { this.error = U.extractErrorMessage(err, 'Could not load the document history.'); this.loading = false; App.update(); },
        );
        this.escape = () => { if (U.registry[key] === this) this.close(); };
        U.onEscape(this.escape);
      },
      destroy() { App.escapeHandlers = App.escapeHandlers.filter((f) => f !== this.escape); },
      close() { const onClosed = this.onClosed; U.destroy(key); if (onClosed) onClosed(); App.update(); },
      open(documentId, download) {
        const version = this.versions.find((v) => v.documentId === documentId);
        this.busyId = documentId;
        this.fileError = null;
        App.update();
        VerificationDocumentService.fileBlob(documentId).then((blob) => {
          this.busyId = null;
          App.update();
          const url = URL.createObjectURL(blob);
          if (download) {
            const link = document.createElement('a');
            link.href = url;
            link.download = version.fileName || `${opts.documentType}-v${version.versionNumber}`;
            link.click();
          } else {
            window.open(url, '_blank', 'noopener');
          }
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        }, () => { this.busyId = null; this.fileError = `Could not load version ${version.versionNumber}.`; App.update(); });
      },
    }));
    inst.onClosed = opts.onClosed;
    const html = U.html;
    const r = inst.ref;
    return html`<app-document-history-dialog>
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div class="card flex max-h-[90vh] w-full max-w-5xl flex-col" role="dialog" aria-modal="true" aria-labelledby="doc-history-title">
        <div class="flex items-start justify-between gap-3">
          <h2 id="doc-history-title" class="m-0 text-lg font-bold text-slate-900">${opts.label} - Document History</h2>
          <button type="button" class="btn-icon !h-8 !w-8 shrink-0" aria-label="Close" onclick="${r}.close()"><i class="fa-solid fa-xmark"></i></button>
        </div>

        ${inst.loading ? html`<div class="flex justify-center py-10"><span class="spinner"></span></div>`
          : inst.error ? html`<p class="mt-4 text-sm font-semibold text-rose-600">${inst.error}</p>`
          : inst.versions.length === 0 ? html`<p class="mt-4 text-sm text-slate-500">No file has been uploaded for this document yet.</p>` : html`
          <div class="table-card mt-4 overflow-auto">
            <table class="custom-table">
              <thead>
                <tr><th>Version</th><th>Uploaded</th><th>Uploaded by</th><th>Status</th><th>Reviewed by</th><th>Reviewer comment / re-upload reason</th><th></th></tr>
              </thead>
              <tbody>
                ${U.each(inst.versions, (v) => html`
                  <tr data-key="${v.documentId}">
                    <td class="font-semibold text-slate-800">v${v.versionNumber}${v.isCurrentVersion ? html`<span class="ml-1 text-xs font-medium text-slate-400">(current)</span>` : ''}</td>
                    <td class="whitespace-nowrap text-slate-600">${U.date(v.uploadedAt, 'medium')}</td>
                    <td>${v.uploadedByName || '-'}</td>
                    <td><span class="badge ${documentStatusBadgeClass(v.documentStatus)}">${documentStatusLabel(v.documentStatus)}</span></td>
                    <td>${v.reviewerName || 'Pending'}${v.reviewedAt ? html`<span class="block text-xs text-slate-400">${U.date(v.reviewedAt, 'medium')}</span>` : ''}</td>
                    <td class="max-w-xs text-sm text-slate-600">${v.reuploadReason || v.reviewerComment || '-'}</td>
                    <td class="whitespace-nowrap">
                      <button type="button" class="btn-outline !px-2 !py-1 text-xs" ${U.dis(inst.busyId === v.documentId)} onclick="${r}.open(${U.arg(v.documentId)}, false)"><i class="fa-solid fa-eye"></i> View</button>
                      <button type="button" class="btn-outline !px-2 !py-1 text-xs" ${U.dis(inst.busyId === v.documentId)} onclick="${r}.open(${U.arg(v.documentId)}, true)"><i class="fa-solid fa-file-arrow-down"></i> Download</button>
                    </td>
                  </tr>`)}
              </tbody>
            </table>
          </div>
          ${inst.fileError ? html`<p class="mt-3 text-sm font-semibold text-rose-600">${inst.fileError}</p>` : ''}`}
      </div>
    </div>
  </app-document-history-dialog>`;
  };
})();
