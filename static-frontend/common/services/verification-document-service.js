/*
 * VerificationDocumentService - port of the Angular VerificationDocumentService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.VerificationDocumentService = {
    byQueue: (id) => Api.get(`/api/verification-documents/queue/${id}`),
    history: (id, documentTypeName) => Api.get(`/api/verification-documents/queue/${id}/history`, { documentTypeName }),
    decide: (documentId, result, reason) => Api.post(`/api/verification-documents/${documentId}/decision`, { result, reason: reason ?? null }),
    fileBlob: (documentId) => Api.get(`/api/verification-documents/${documentId}/file`).then(FileBlobs.from),
    upload: (verificationQueueId, documentTypeName, file) => Api.readFile(file).then((f) => Api.post('/api/verification-documents/upload', { verificationQueueId, documentTypeName, file: f })),
  };
})();
