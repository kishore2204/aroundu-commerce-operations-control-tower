/*
 * <app-document-history-dialog> - port of shared/document-history/document-history-dialog.component.ts:
 * every version of ONE verification document, newest first, with view / download of each version.
 *
 *   DocumentHistoryDialog({ queueId, documentType, label, onClosed })
 */
(function () {
  function documentStatusLabel(status) {
    switch ((status ?? '').toUpperCase()) {
      case 'APPROVED':
        return 'Approved';
      case 'REJECTED':
        return 'Re-upload Required';
      case 'RESUBMITTED':
        return 'Resubmitted';
      default:
        return 'Pending Review';
    }
  }
  function documentStatusBadgeClass(status) {
    switch ((status ?? '').toUpperCase()) {
      case 'APPROVED':
        return 'badge-active';
      case 'REJECTED':
        return 'badge-danger';
      default:
        return 'badge-pending';
    }
  }
  window.DocumentStatus = { label: documentStatusLabel, badgeClass: documentStatusBadgeClass };

  window.DocumentHistoryDialog = function (opts) {
    const key = `doc-history-${opts.queueId}-${opts.documentType}`;
    const inst = U.component(key, () => ({
      versions: [],
      loading: true,
      error: null,
      fileError: null,
      busyId: null,
      init() {
        VerificationDocumentService.history(opts.queueId, opts.documentType).then(
          (versions) => {
            this.versions = versions;
            this.loading = false;
            App.update();
          },
          (err) => {
            this.error = U.extractErrorMessage(err, 'Could not load the document history.');
            this.loading = false;
            App.update();
          },
        );
        this.escape = () => {
          if (U.registry[key] === this) this.close();
        };
        U.onEscape(this.escape);
      },
      destroy() {
        App.escapeHandlers = App.escapeHandlers.filter((f) => f !== this.escape);
      },
      close() {
        const onClosed = this.onClosed;
        U.destroy(key);
        if (onClosed) onClosed();
        App.update();
      },
      open(documentId, download) {
        const version = this.versions.find((v) => v.documentId === documentId);
        this.busyId = documentId;
        this.fileError = null;
        App.update();
        VerificationDocumentService.fileBlob(documentId).then(
          (blob) => {
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
          },
          () => {
            this.busyId = null;
            this.fileError = `Could not load version ${version.versionNumber}.`;
            App.update();
          },
        );
      },
    }));
    inst.onClosed = opts.onClosed;
    const r = inst.ref;
    return U.tpl('document-history-dialog', [
      opts.label,
      r,
      inst.loading
        ? U.tpl('document-history-dialog-1')
        : inst.error
          ? U.tpl('document-history-dialog-2', [inst.error])
          : inst.versions.length === 0
            ? U.tpl('document-history-dialog-3')
            : U.tpl('document-history-dialog-4', [
                U.each(inst.versions, (v) =>
                  U.tpl('document-history-dialog-4-1', [
                    v.documentId,
                    v.versionNumber,
                    v.isCurrentVersion ? U.tpl('document-history-dialog-4-1-1') : '',
                    U.date(v.uploadedAt, 'medium'),
                    v.uploadedByName || '-',
                    documentStatusBadgeClass(v.documentStatus),
                    documentStatusLabel(v.documentStatus),
                    v.reviewerName || 'Pending',
                    v.reviewedAt ? U.tpl('document-history-dialog-4-1-2', [U.date(v.reviewedAt, 'medium')]) : '',
                    v.reuploadReason || v.reviewerComment || '-',
                    U.dis(inst.busyId === v.documentId),
                    r,
                    U.arg(v.documentId),
                    U.dis(inst.busyId === v.documentId),
                    r,
                    U.arg(v.documentId),
                  ]),
                ),
                inst.fileError ? U.tpl('document-history-dialog-4-2', [inst.fileError]) : '',
              ]),
    ]);
  };
})();
