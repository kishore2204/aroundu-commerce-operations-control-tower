/** S2 VerificationQueueDTO */
export interface VerificationQueue {
  verificationQueueId: string;
  subjectType: 'RETAILER' | 'FLEET_OWNER' | 'DRIVER' | 'VEHICLE' | string;
  subjectId: string;
  zoneId: string | null;
  isActive: boolean;
  submittedByAccountId: string;
  reviewedByAccountId: string | null;
  verificationStatus: string;
  rejectionReason: string | null;
  suspensionReason: string | null;
  deletionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** S2 VerificationDocumentDTO */
export interface VerificationDocument {
  documentId: string;
  verificationQueueId: string;
  documentTypeName: string;
  versionNumber: number;
  fileName: string | null;
  contentType: string | null;
  fileSizeBytes: number | null;
  expiryDate: string | null;
  documentStatus: string;
  rejectReason: string | null;
  isCurrentVersion: boolean;
  createdAt: string;
  updatedAt: string;
}

/** S2 DocumentVersionDTO - one immutable version in a document's history (people by name, never by id). */
export interface DocumentVersion {
  documentId: string;
  versionNumber: number;
  fileName: string | null;
  contentType: string | null;
  fileSizeBytes: number | null;
  documentStatus: string;
  isCurrentVersion: boolean;
  uploadedAt: string;
  uploadedByName: string | null;
  reviewedAt: string | null;
  /** null while the version is still awaiting review. */
  reviewerName: string | null;
  reviewerComment: string | null;
  /** Why a new upload was requested for this version (only when it is Re-upload Required). */
  reuploadReason: string | null;
}

/** What a stored document status is called on screen. REJECTED is the "Re-upload Required" state. */
export function documentStatusLabel(status: string | null | undefined): string {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED': return 'Approved';
    case 'REJECTED': return 'Re-upload Required';
    case 'RESUBMITTED': return 'Resubmitted';
    default: return 'Pending Review';
  }
}

export function documentStatusBadgeClass(status: string | null | undefined): string {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED': return 'badge-active';
    case 'REJECTED': return 'badge-danger';
    default: return 'badge-pending';
  }
}

/** S2 PendingWorkItemDTO - one pending verification request of a Location Manager (partner by name, never by id). */
export interface PendingWorkItem {
  verificationQueueId: string;
  subjectType: string;
  subjectName: string | null;
  verificationStatus: string;
  submittedAt: string;
}

/** S2 TransferWorkResultDTO - only ids in `transferred` have moved; `remainingPending` is what the officer still holds. */
export interface TransferWorkResult {
  transferred: string[];
  failed: { verificationQueueId: string; reason: string }[];
  remainingPending: number;
}
