import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DocumentVersion, VerificationDocument } from '../models/verification.model';

@Injectable({ providedIn: 'root' })
export class VerificationDocumentService {
  constructor(private readonly http: HttpClient) {}

  byQueue(verificationQueueId: string): Observable<VerificationDocument[]> {
    return this.http.get<VerificationDocument[]>(`/api/verification-documents/queue/${verificationQueueId}`);
  }

  /** Every uploaded version (newest first) of one document type in a queue - "View Document History". */
  history(verificationQueueId: string, documentTypeName: string): Observable<DocumentVersion[]> {
    return this.http.get<DocumentVersion[]>(`/api/verification-documents/queue/${verificationQueueId}/history`, {
      params: { documentTypeName },
    });
  }

  /** Location Manager decision for one current document. Rejection requests only this document again. */
  decide(documentId: string, result: 'APPROVED' | 'REJECTED', reason?: string): Observable<VerificationDocument> {
    return this.http.post<VerificationDocument>(`/api/verification-documents/${documentId}/decision`, { result, reason: reason ?? null });
  }

  /** Raw file bytes for a document - fetched through HttpClient (not a plain <img src>) so the
   *  auth interceptor attaches the JWT the endpoint requires. */
  fileBlob(documentId: string): Observable<Blob> {
    return this.http.get(`/api/verification-documents/${documentId}/file`, { responseType: 'blob' });
  }

  /** The only path that actually stores real file bytes (see
   *  VerificationDocumentServiceImpl.uploadVerificationDocument) - the metadata-only
   *  submit-documents calls (fleet-owner/retailer onboarding) never do. Creates the next
   *  version of the named document type against an already-existing queue. */
  upload(verificationQueueId: string, documentTypeName: string, file: File): Observable<VerificationDocument> {
    const formData = new FormData();
    formData.append('verificationQueueId', verificationQueueId);
    formData.append('documentTypeName', documentTypeName);
    formData.append('file', file);
    return this.http.post<VerificationDocument>('/api/verification-documents/upload', formData);
  }
}
