import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PendingWorkItem, TransferWorkResult, VerificationQueue } from '../models/verification.model';
import { AUDIT_SUBJECT } from '../api/audit-events';

@Injectable({ providedIn: 'root' })
export class VerificationQueueService {
  constructor(private readonly http: HttpClient) {}

  /** zoneId scopes the results to a single zone - used for a Location Manager, who must only
   *  ever see requests from their own zone. */
  byStatus(status: string, zoneId?: string): Observable<VerificationQueue[]> {
    let params = new HttpParams();
    if (zoneId) params = params.set('zoneId', zoneId);
    return this.http.get<VerificationQueue[]>(`/api/verification-queues/status/${status}`, { params });
  }

  all(zoneId?: string): Observable<VerificationQueue[]> {
    let params = new HttpParams();
    if (zoneId) params = params.set('zoneId', zoneId);
    return this.http.get<VerificationQueue[]>('/api/verification-queues', { params });
  }

  get(id: string): Observable<VerificationQueue> {
    return this.http.get<VerificationQueue>(`/api/verification-queues/${id}`);
  }

  bySubject(subjectId: string): Observable<VerificationQueue[]> {
    return this.http.get<VerificationQueue[]>(`/api/verification-queues/subject/${subjectId}`);
  }

  /** Common submit step for any subject type (RETAILER/FLEET_OWNER/DRIVER/VEHICLE) - flips a DOCUMENTS_SUBMITTED queue to SENT_TO_LOCATION_MANAGER. */
  submitForVerification(id: string): Observable<void> {
    return this.http.post<void>(`/api/verification-queues/${id}/submit-for-verification`, {});
  }

  /** A Location Manager's pending verification work - what must be handed over before they can be disabled, deactivated or moved. */
  pendingWork(reviewerAccountId: string): Observable<PendingWorkItem[]> {
    return this.http.get<PendingWorkItem[]>(`/api/verification-queues/pending-work/${reviewerAccountId}`);
  }

  /** Moves the chosen pending requests to another Location Manager; each moves or fails on its own. */
  transferWork(fromReviewerAccountId: string, toReviewerAccountId: string, verificationQueueIds: string[]): Observable<TransferWorkResult> {
    return this.http.post<TransferWorkResult>('/api/verification-queues/transfer-work', {
      fromReviewerAccountId,
      toReviewerAccountId,
      verificationQueueIds,
    });
  }

  /** subjectType (RETAILER/FLEET_OWNER/DRIVER/VEHICLE) is only used to word the audit entry
   *  ("Approve Fleet Owner"); it is not sent to the server. */
  processResult(id: string, result: 'APPROVED' | 'REJECTED', reason?: string, subjectType?: string): Observable<void> {
    return this.http.post<void>(`/api/verification-queues/${id}/process-result`, { result, reason }, {
      context: new HttpContext().set(AUDIT_SUBJECT, subjectType ?? null),
    });
  }

  /** Blocks a subject that was previously APPROVED - allowed at any later time, unlike
   *  processResult which is a one-time terminal decision. */
  revoke(id: string, reason: string): Observable<void> {
    return this.http.post<void>(`/api/verification-queues/${id}/revoke`, { reason });
  }
}
