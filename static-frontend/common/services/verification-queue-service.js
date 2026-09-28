/*
 * VerificationQueueService - port of the Angular VerificationQueueService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.VerificationQueueService = {
    byStatus: (status, zoneId) => Api.get(`/api/verification-queues/status/${status}`, { zoneId }),
    all: (zoneId) => Api.get('/api/verification-queues', { zoneId }),
    get: (id) => Api.get(`/api/verification-queues/${id}`),
    bySubject: (subjectId) => Api.get(`/api/verification-queues/subject/${subjectId}`),
    submitForVerification: (id) => Api.post(`/api/verification-queues/${id}/submit-for-verification`, {}),
    pendingWork: (reviewerAccountId) => Api.get(`/api/verification-queues/pending-work/${reviewerAccountId}`),
    transferWork: (fromReviewerAccountId, toReviewerAccountId, verificationQueueIds) => Api.post('/api/verification-queues/transfer-work', { fromReviewerAccountId, toReviewerAccountId, verificationQueueIds }),
    processResult: (id, result, reason, subjectType) => Api.post(`/api/verification-queues/${id}/process-result`, { result, reason }, { auditSubject: subjectType ?? null }),
    revoke: (id, reason) => Api.post(`/api/verification-queues/${id}/revoke`, { reason }),
  };
})();
