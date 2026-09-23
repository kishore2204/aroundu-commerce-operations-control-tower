# CHG0030047 — Document Re-Upload Workflow and Historical Document Management

## 1. CR Overview

| Item | Detail |
| --- | --- |
| CR number | CHG0030047 |
| Title | Document Re-Upload Workflow and Historical Document Management |
| Purpose | Let a Location Manager request a re-upload of one document with a mandatory reason, notify the user in-app, keep every uploaded version, and let reviewers and users see the full per-document history |
| Main affected area | S2 partner-verification service (documents, queue), S6 notifications (reused), the Location Manager **queue detail** page, retailer/fleet **onboarding** pages, and a new **document history** dialog |

## 2. Understanding the CR

**What was requested**

- The Location Manager can request a re-upload of a rejected / incorrect document, with a **comment giving the reason**.
- The user receives an **in-app notification** when a re-upload is requested.
- The user uploads a revised document; the Location Manager then approves it or requests another re-upload. This can repeat.
- **All previous versions are retained** (audit/compliance), with version numbers, upload timestamps, status history and reviewer comments.

**Why it was required**

Verification is document-by-document. A single wrong document should not force the user to start again, and reviewers must be able to see exactly what was submitted, when, by whom and what was said about it.

**Lifecycle**

```text
Upload (v1, Pending Review)
    ↓
Location Manager reviews
    ├── Approve → Approved
    └── Request re-upload (reason mandatory) → Re-upload Required  + notification to the user
                    ↓
            User uploads a revised file → new version v2 (Resubmitted)
                    ↓
            Location Manager reviews v2 → Approved  or  Re-upload Required again (v3, v4 … unlimited)
```

## 3. Existing Problem

- The document table already created a **new row per upload** (`versionNumber`, `isCurrentVersion`) and the queue detail page already had a *Request re-upload* button, but:
  - a version row did not record **who uploaded it**, **who reviewed it**, **when it was reviewed**, or a reviewer comment separate from the rejection text;
  - there was **no way to see the history** of a document — only the current version was returned (`getVerificationDocumentsByQueueId` deliberately returns current versions only);
  - the user was **not notified**: the S2→S6 `NotificationClient` existed but was never called;
  - stored versions could be **edited or deleted** through the generic `PUT`/`DELETE /api/verification-documents/{id}`;
  - an already **approved** document could be silently replaced by a new upload;
  - the status shown to users was just `PENDING` / `REJECTED`, with no distinction for "resubmitted after a re-upload request";
  - a missing reason or wrong status raised a plain `IllegalArgumentException` that surfaced as a generic server error.

## 4. Root Cause

The data model kept versions but not the *review trail* around them, and no endpoint, UI or notification exposed it. The immutability of history was a convention, not a rule enforced by the service.

## 5. Solution

Extend the existing document model instead of adding a second table:

1. **Version rows are the history.** Every upload is a new `verification_document` row; the older row is kept and only its `isCurrentVersion` flag is turned off.
2. **Four new nullable columns** record the trail: `uploaded_by_account_id`, `reviewed_by_account_id`, `reviewed_at`, `reviewer_comment`.
3. **A new status `RESUBMITTED`** marks an upload that answers a re-upload request (so `PENDING` = first submission, `RESUBMITTED` = corrected version).
4. **A history endpoint** returns all versions of one document type, newest first, with names instead of ids.
5. **In-app notification** through the existing S2 → S6 notification client, sent after the decision commits.
6. **Immutability guards** on update/delete of stored versions and on replacing an approved version.

```text
Location Manager: "Request re-upload" + reason
    ↓
Frontend queue-detail → POST /api/verification-documents/{id}/decision {result: REJECTED, reason}
    ↓
VerificationDocumentController → VerificationDocumentServiceImpl.decideVerificationDocument
    ↓  reason mandatory · sets status REJECTED, reject_reason, reviewer, reviewed_at, reviewer_comment
    ↓  queue → RESUBMISSION_REQUIRED
    ↓  after commit: NotificationClient.create → S6 /api/v1/internal/notifications
    ↓
User opens Notifications / onboarding → uploads revised file
    ↓
POST /api/verification-documents/upload → uploadVerificationDocument
    ↓  new row: version n+1, status RESUBMITTED, uploaded_by = user, previous row → is_current_version=false
    ↓
User "Resubmit" → submit-for-verification (blocked while any current document is still REJECTED)
    ↓
Location Manager reviews the new version → Approved or another re-upload request
```

## 6. Implementation Details

### 6.1 Database

Table `verification_document` (existing) — new nullable columns, added automatically by `spring.jpa.hibernate.ddl-auto=update`:

| Column | Meaning |
| --- | --- |
| `uploaded_by_account_id` | Account that uploaded this version |
| `reviewed_by_account_id` | Location Manager who reviewed this version (null while awaiting review) |
| `reviewed_at` | When it was reviewed |
| `reviewer_comment` | Reviewer's note (the re-upload reason, or an optional approval comment) |

Existing columns used: `version_number`, `is_current_version`, `document_status`, `reject_reason`, `created_at` (= upload time of this version), `file_content`, `file_name`, `content_type`, `file_size_bytes`.

Status values: `PENDING` (Pending Review), `RESUBMITTED` (Resubmitted), `REJECTED` (shown as **Re-upload Required**), `APPROVED`. Stored values did not change, so existing queries and the existing queue rules keep working.

### 6.2 Upload (`uploadVerificationDocument`)

- Finds all versions of that queue + document type; next version = highest + 1.
- If the current version is `APPROVED` → refuses (*"…A new version can only be uploaded after a re-upload is requested."*).
- If the current version is `REJECTED` → the new row is `RESUBMITTED`, otherwise `PENDING`.
- Marks every other current row `is_current_version = false` (history kept, no data deleted).
- Stores the uploader's account id from the JWT and clears review fields on the new row.
- Older onboarding code created a byte-less placeholder row first; that row is filled instead of creating a phantom second document.

### 6.3 Decision (`decideVerificationDocument`)

- Only the **current** version can be reviewed.
- `REJECTED` (re-upload request) **requires a non-blank reason**.
- Records `reviewed_by_account_id`, `reviewed_at`, `reviewer_comment`, and for a re-upload request `reject_reason`.
- For a re-upload request the queue becomes `RESUBMISSION_REQUIRED` (existing behavior) and the notification is sent.
- Errors now use `InvalidVerificationTransitionException` (HTTP 409 with the message), and a global handler returns 400 for `IllegalArgumentException`.

### 6.4 Notification

`notifyReuploadRequested` sends a notification through the existing S2 `NotificationClient` to S6's internal endpoint:

| Field | Value |
| --- | --- |
| recipient | The account that submitted the queue entry |
| role | `RETAILER` for retailers, otherwise `FLEET_MANAGER` |
| type | `DOCUMENT_REUPLOAD_REQUIRED` |
| title / message | "Document re-upload required" / "*<Document label>* needs to be uploaded again. Reason: *<reason>*" |

It is registered to run **after the transaction commits** and is best-effort: a failure is logged and never rolls back the review decision. So users can see it, the retailer Notifications route no longer requires a verified profile, and Fleet Managers got a Notifications menu item that reuses the same page.

### 6.5 History

`getDocumentHistory(queueId, documentTypeName)` (`GET /api/verification-documents/queue/{queueId}/history?documentTypeName=…`) returns `DocumentVersionDTO` per version: version number, file name/type/size, status, is-current, upload time, **uploaded-by name**, review time, **reviewer name** (null → the screen shows "Pending"), reviewer comment, re-upload reason.

- One repository query (`findVersionRows`) selects columns only — **the file bytes are never loaded** for a list of up to 10 MB files — and skips byte-less placeholder rows.
- Names come from S1 through `AccountLookupClient`, looked up once per person per request; if a lookup fails the labels "Submitter"/"Reviewer" are shown.
- Access: reviewers (Super Admin, Operations Manager, Location Manager) or the account that submitted that queue entry.
- Old versions are viewed/downloaded through the existing `GET /api/verification-documents/{id}/file` endpoint.

### 6.6 Immutability

`assertNotSubmittedVersion` blocks `PUT` and `DELETE` on any row that has file content, so an uploaded version can only be superseded by a new one.

### 6.7 Frontend

- **`verification.model.ts`** → `DocumentVersion`, `documentStatusLabel`, `documentStatusBadgeClass` (Pending Review / Resubmitted / Re-upload Required / Approved).
- **`verification-document.service.ts`** → `history(queueId, type)`.
- **`shared/document-history/document-history-dialog.component.ts`** (new) → table of versions newest first with **View** and **Download** per version (fetched through `HttpClient` so the JWT is attached).
- **`queue-detail.component.ts/.html`** → status labels, "Re-upload reason", a **View Document History** link per document, and the existing *Request re-upload* action (reason required; button disabled until entered).
- **Retailer and Fleet onboarding** → **View Document History** on each document row once a queue exists.
- **`app.routes.ts` / `fleet-shell`** → notifications reachable by unverified retailers and by Fleet Managers.

### 6.8 Audit

This CR did **not** add new audit-log entries for document actions. The traceability the CR asks for is carried by the version rows themselves (version number, upload timestamp, uploader, status, reviewer, review timestamp, comment). The already-existing audit whitelist (`audit-events.ts`) still records `POST verification-documents/decision` when an internal role decides a document.

## 7. Execution Flow

1. Retailer submits four documents; each becomes v1, `PENDING`, `uploaded_by` = the retailer.
2. Location Manager opens the queue entry. Documents show *Pending Review*.
3. LM approves three; on the fourth types *"Image is blurred"* and clicks **Request re-upload**.
4. Backend: document → `REJECTED`, `reject_reason` and `reviewer_comment` = the reason, reviewer and time stored; queue → `RESUBMISSION_REQUIRED`; notification sent after commit.
5. Retailer sees the notification (and the onboarding page shows *Re-upload required*).
6. Retailer uploads a new file → **v2**, status `RESUBMITTED`; v1 remains with its file, status and reason.
7. Retailer clicks *Resubmit*. The queue accepts it only if no current document is still `REJECTED`.
8. LM reviews v2: **Approve**, or request a re-upload again → v3, and so on.
9. At any time, **View Document History** lists v1…vN with uploader, times, statuses, reviewer and comments; each version can be viewed or downloaded.

**Alternate flows**

| Situation | Result |
| --- | --- |
| Re-upload request without a reason | 409 *"A reason is required when requesting a re-upload"* |
| Reviewing an old (non-current) version | 409 *"Only the current document version can be reviewed"* |
| Uploading over an already approved version | 409 *"This document is already approved…"* |
| `PUT`/`DELETE` on a stored version | 409 *"An uploaded document version cannot be changed or deleted…"* |
| Resubmit while a rejected document is still not replaced | 409 *"Re-upload every rejected document before resubmitting. Remaining: …"* |
| S6 unavailable when notifying | Decision still saved; failure logged |
| S1 unavailable when building history | Names shown as "Submitter"/"Reviewer" |
| Another user opens someone else's history | 403 |

## 8. Important Files Changed

| Layer | File | Change |
| --- | --- | --- |
| Entity (S2) | `entity/VerificationDocument.java` | 4 new columns |
| DTO (S2) | `dto/DocumentVersionDTO.java` | New — one version in the history |
| Repository (S2) | `repository/VerificationDocumentRepository.java` | `findVersionRows` projection (no file bytes) |
| Service (S2) | `service/VerificationDocumentServiceImpl.java` | Upload versioning, decision metadata, notification, history, immutability |
| Service (S2) | `service/VerificationDocumentService.java` | `getDocumentHistory` |
| Controller (S2) | `controller/VerificationDocumentController.java` | History endpoint |
| Client (S2) | `client/AccountLookupClient.java` | Name lookup (new); `NotificationClient` (existing, now used) |
| Exception (S2) | `exception/GlobalExceptionHandler.java` | 400 for `IllegalArgumentException` |
| Frontend | `shared/document-history/document-history-dialog.component.ts` | New history dialog |
| Frontend | `queue-detail.component.ts/.html` | Labels, reason, history link |
| Frontend | `retailer/onboarding/*`, `fleet/onboarding/*` | History link |
| Frontend | `app.routes.ts`, `fleet-shell.component.ts`, `notifications.component.html` | Notifications reachable for retailers/fleet |
| Frontend | `verification.model.ts`, `verification-document.service.ts` | Types, labels, API |
| Tests | `VerificationDocumentReuploadWorkflowTest` | 12 tests for the lifecycle |

## 9. Important Code Changes

### 9.1 New trail columns — `S2-partner-verification/.../entity/VerificationDocument.java`

```java
/** Account that uploaded this version (null on versions created before re-upload tracking). */
@Column(name = "uploaded_by_account_id")
private UUID uploadedByAccountId;

/** Location Manager who last reviewed this version; null while it is still awaiting review. */
@Column(name = "reviewed_by_account_id")
private UUID reviewedByAccountId;

@Column(name = "reviewed_at")
private OffsetDateTime reviewedAt;

/** The reviewer's note on this version (the re-upload reason, or an optional approval comment). */
@Column(name = "reviewer_comment", columnDefinition = "TEXT")
private String reviewerComment;
```

### 9.2 Upload creates a new immutable version — `.../service/VerificationDocumentServiceImpl.java`

```java
// Every upload is a NEW version; the one it replaces is kept as history. A version that is
// already approved is only replaced after the Location Manager asks for a re-upload.
Optional<VerificationDocument> previousCurrent = existingVersions.stream()
        .filter(doc -> Boolean.TRUE.equals(doc.getIsCurrentVersion()) && doc.getFileContent() != null)
        .max(Comparator.comparing(doc -> doc.getVersionNumber() == null ? 0 : doc.getVersionNumber()));
if (previousCurrent.isPresent() && "APPROVED".equalsIgnoreCase(previousCurrent.get().getDocumentStatus())) {
    throw new InvalidVerificationTransitionException(
            "This document is already approved. A new version can only be uploaded after a re-upload is requested.");
}
boolean answersReuploadRequest = previousCurrent.isPresent()
        && "REJECTED".equalsIgnoreCase(previousCurrent.get().getDocumentStatus());
```

```java
entity = new VerificationDocument();
entity.setVerificationQueueId(verificationQueueId);
entity.setDocumentTypeName(documentTypeName);
entity.setVersionNumber(nextVersionNumber);
entity.setCreatedAt(OffsetDateTime.now());
...
existingVersions.stream()
        .filter(doc -> Boolean.TRUE.equals(doc.getIsCurrentVersion()) && doc != selectedEntity)
        .forEach(doc -> {
            doc.setIsCurrentVersion(false);
            doc.setUpdatedAt(OffsetDateTime.now());
            verificationDocumentRepository.save(doc);
        });

entity.setFileContent(storedDocument.content());
...
entity.setDocumentStatus(answersReuploadRequest ? "RESUBMITTED" : "PENDING");
entity.setRejectReason(null);
entity.setUploadedByAccountId(resolveAuthenticatedAccountId());
entity.setReviewedByAccountId(null);
entity.setReviewedAt(null);
entity.setReviewerComment(null);
entity.setIsCurrentVersion(true);
```

Explanation: the previous row keeps its file, status and reason and is only flagged non-current; the new row is `RESUBMITTED` when it answers a re-upload request.

### 9.3 Re-upload request with mandatory reason — same file

```java
if (!Boolean.TRUE.equals(document.getIsCurrentVersion())) {
    throw new InvalidVerificationTransitionException("Only the current document version can be reviewed");
}
if ("REJECTED".equalsIgnoreCase(result) && (reason == null || reason.isBlank())) {
    throw new InvalidVerificationTransitionException("A reason is required when requesting a re-upload");
}
boolean reuploadRequested = "REJECTED".equalsIgnoreCase(result);
OffsetDateTime now = OffsetDateTime.now();
document.setDocumentStatus(result.toUpperCase());
document.setRejectReason(reuploadRequested ? reason.trim() : null);
document.setReviewerComment(reason == null || reason.isBlank() ? null : reason.trim());
document.setReviewedByAccountId(resolveAuthenticatedAccountId());
document.setReviewedAt(now);
document.setUpdatedAt(now);
VerificationDocument saved = verificationDocumentRepository.save(document);

if ("REJECTED".equalsIgnoreCase(result)) {
    com.example.lbos.entity.VerificationQueue queue = verificationQueueRepository.findById(document.getVerificationQueueId())
            .orElseThrow(() -> new VerificationQueueNotFoundException("VerificationQueue not found with id: " + document.getVerificationQueueId()));
    queue.setVerificationStatus("RESUBMISSION_REQUIRED");
    queue.setRejectionReason(document.getDocumentTypeName() + ": " + reason.trim());
    queue.setIsActive(true);
    queue.setUpdatedAt(OffsetDateTime.now());
    verificationQueueRepository.save(queue);
    notifyReuploadRequested(queue, document, reason.trim());
}
```

### 9.4 In-app notification after commit — same file

```java
NotificationClient.NotificationCreateRequest request = new NotificationClient.NotificationCreateRequest(
        queue.getSubmittedByAccountId(),
        "RETAILER".equalsIgnoreCase(queue.getSubjectType()) ? "RETAILER" : "FLEET_MANAGER",
        "DOCUMENT_REUPLOAD_REQUIRED",
        "VERIFICATION_QUEUE",
        String.valueOf(queue.getVerificationQueueId()),
        "Document re-upload required",
        documentLabel(document.getDocumentTypeName()) + " needs to be uploaded again. Reason: " + reason);
...
if (TransactionSynchronizationManager.isSynchronizationActive()) {
    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
        @Override
        public void afterCommit() {
            send.run();
        }
    });
} else {
    send.run();
}
```

### 9.5 Immutability guard — same file

```java
/** A stored version (one with file bytes) is history: it can be superseded by a new version, never edited or deleted. */
private void assertNotSubmittedVersion(VerificationDocument document) {
    if (document.getFileContent() != null) {
        throw new InvalidVerificationTransitionException(
                "An uploaded document version cannot be changed or deleted. Upload a new version instead.");
    }
}
```

Used at the start of `updateVerificationDocument(...)` and in `deleteVerificationDocument(...)`.

### 9.6 History without loading file bytes — `.../repository/VerificationDocumentRepository.java`

```java
@Query("select d.documentId as documentId, d.versionNumber as versionNumber, d.fileName as fileName, "
        + "d.contentType as contentType, d.fileSizeBytes as fileSizeBytes, d.documentStatus as documentStatus, "
        + "d.isCurrentVersion as isCurrentVersion, d.createdAt as createdAt, d.updatedAt as updatedAt, "
        + "d.uploadedByAccountId as uploadedByAccountId, d.reviewedByAccountId as reviewedByAccountId, "
        + "d.reviewedAt as reviewedAt, d.reviewerComment as reviewerComment, d.rejectReason as rejectReason "
        + "from VerificationDocument d where d.verificationQueueId = :queueId and d.documentTypeName = :type "
        + "and d.fileContent is not null order by d.versionNumber desc")
List<VersionRow> findVersionRows(@Param("queueId") UUID verificationQueueId, @Param("type") String documentTypeName);
```

### 9.7 Building the history — `VerificationDocumentServiceImpl.getDocumentHistory`

```java
dto.setDocumentStatus(status);
dto.setIsCurrentVersion(row.getIsCurrentVersion());
dto.setUploadedAt(row.getCreatedAt());
dto.setUploadedByName(displayName(uploaderId, names, "Submitter"));
dto.setReviewerName(reviewerId == null ? null : displayName(reviewerId, names, "Reviewer"));
dto.setReviewedAt(row.getReviewedAt() != null ? row.getReviewedAt() : decided ? row.getUpdatedAt() : null);
dto.setReviewerComment(row.getReviewerComment() != null ? row.getReviewerComment()
        : "REJECTED".equals(status) ? row.getRejectReason() : null);
dto.setReuploadReason("REJECTED".equals(status) ? row.getRejectReason() : null);
```

Access rule:

```java
boolean reviewer = authentication.getAuthorities().stream().anyMatch(authority -> java.util.Set.of(
        "ROLE_SUPER_ADMIN", "ROLE_OPERATIONS_MANAGER", "ROLE_LOCATION_MANAGER").contains(authority.getAuthority()));
UUID caller = resolveAuthenticatedAccountId();
if (!reviewer && (caller == null || !caller.equals(queue.getSubmittedByAccountId()))) {
    throw new ForbiddenActionException("You do not have access to this document's history");
}
```

### 9.8 History endpoint — `.../controller/VerificationDocumentController.java`

```java
@GetMapping("/queue/{verificationQueueId}/history")
public ResponseEntity<List<com.example.lbos.dto.DocumentVersionDTO>> getDocumentHistory(
        @PathVariable UUID verificationQueueId, @RequestParam("documentTypeName") String documentTypeName) {
    requireQueueInScope(verificationQueueId);
    return ResponseEntity.ok(service.getDocumentHistory(verificationQueueId, documentTypeName));
}
```

### 9.9 Resubmission rule (existing, now reachable through the new flow) — `.../service/VerificationQueueServiceImpl.java`

```java
if (resubmission) {
    List<com.example.lbos.entity.VerificationDocument> stillRejected = verificationDocumentRepository
            .findByVerificationQueueIdAndIsCurrentVersion(queueId, true).stream()
            .filter(document -> "REJECTED".equalsIgnoreCase(document.getDocumentStatus()))
            .toList();
    if (!stillRejected.isEmpty()) {
        throw new InvalidVerificationTransitionException(
                "Re-upload every rejected document before resubmitting. Remaining: "
                        + stillRejected.stream().map(com.example.lbos.entity.VerificationDocument::getDocumentTypeName)
                                .distinct().sorted().collect(java.util.stream.Collectors.joining(", ")));
    }
}
```

### 9.10 Frontend labels and history call — `frontend/.../verification.model.ts` and `verification-document.service.ts`

```ts
export function documentStatusLabel(status: string | null | undefined): string {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED': return 'Approved';
    case 'REJECTED': return 'Re-upload Required';
    case 'RESUBMITTED': return 'Resubmitted';
    default: return 'Pending Review';
  }
}
```

```ts
history(verificationQueueId: string, documentTypeName: string): Observable<DocumentVersion[]> {
  return this.http.get<DocumentVersion[]>(`/api/verification-documents/queue/${verificationQueueId}/history`, {
    params: { documentTypeName },
  });
}
```

### 9.11 Queue detail — `frontend/.../queue-detail.component.html`

```html
<span class="badge" [class]="statusBadgeClass(doc.documentStatus)">{{ statusLabel(doc.documentStatus) }}</span>
...
@if (doc.rejectReason) { <p class="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700"><strong>Re-upload reason:</strong> {{ doc.rejectReason }}</p> }
<button type="button" class="mt-2 text-xs font-semibold text-zepto-600 hover:underline" (click)="historyFor.set(expected)"><i class="fa-solid fa-clock-rotate-left mr-1"></i>View Document History</button>
```

```html
<input class="input" [(ngModel)]="documentRejectReasons[doc.documentId]" placeholder="Reason required if this document must be re-uploaded" />
<button type="button" class="btn-outline !border-rose-500 !text-rose-600" [disabled]="!!decidingDocumentId() || !documentRejectReasons[doc.documentId]" (click)="reviewDocument(doc, 'REJECTED')"><i class="fa-solid fa-rotate-left"></i> Request re-upload</button>
```

### 9.12 View / download an old version — `frontend/.../document-history-dialog.component.ts`

```ts
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
```

### 9.13 History link on onboarding — `frontend/.../retailer/onboarding/onboarding.component.html`

```html
@if (verificationStatus()?.verificationQueueId) {
  <button type="button" class="mt-1 block text-xs font-semibold text-zepto-600 hover:underline" (click)="historyFor.set({ type: row.documentTypeName, label: row.label })">View Document History</button>
}
```

## 10. Before vs After

| Area | Before | After |
| --- | --- | --- |
| Versions | New row per upload, but no trail | Each version stores uploader, reviewer, review time, comment |
| History | Not visible | **View Document History** per document, with view/download of every version |
| Status wording | Pending / Rejected | Pending Review / Resubmitted / Re-upload Required / Approved |
| Re-upload request | A missing reason raised an unhandled `IllegalArgumentException` (generic server error) | Reason mandatory with a clear 409 message; browser also disables the button |
| Notification | Client existed, never used | In-app notification after commit (best-effort) |
| Immutability | Stored versions could be edited/deleted; approved could be replaced | Blocked; new version only after a re-upload request |
| Names | — | Names shown, never account ids |
| Performance | — | History query selects columns only — file bytes not loaded |

## 11. Testing

| # | Scenario | Expected |
| --- | --- | --- |
| 1 | Retailer uploads four documents | v1 each, *Pending Review* |
| 2 | LM clicks *Request re-upload* with empty reason | Button disabled; API returns 409 *"A reason is required…"* |
| 3 | LM requests re-upload with a reason | Document → *Re-upload Required*; queue → *Waiting for document re-upload*; retailer receives the notification |
| 4 | Retailer uploads a new file | v2 *Resubmitted*; v1 unchanged |
| 5 | Retailer resubmits before replacing a rejected document | 409 *"Re-upload every rejected document…"* |
| 6 | LM requests re-upload of v2, retailer uploads again | v3 *Resubmitted*; history lists v3, v2, v1 |
| 7 | LM approves the latest version | *Approved*; further upload refused until a re-upload is requested |
| 8 | **View Document History** | Rows with version, upload time, uploaded by, status, reviewed by (or *Pending*), comment / reason |
| 9 | View and Download v1 | The original v1 file opens / downloads |
| 10 | `PUT`/`DELETE` a stored version by API | 409 |
| 11 | Another retailer opens this queue's history | 403 |
| 12 | Stop S6, request re-upload | Decision saved; no notification; error only in the log |
| 13 | Fleet Manager driver/vehicle document rejected | Notification role `FLEET_MANAGER`; existing driver/vehicle re-upload flow continues to work |

Automated: `VerificationDocumentReuploadWorkflowTest` (reason required; reviewer/queue/notification recorded; notification failure tolerated; approval sends none; new version keeps the old one intact; version numbering across cycles; approved not replaceable; stored versions immutable; history with names; history fallback when names unavailable; access rules; document labels).

## 12. Final Result

Document verification now supports unlimited correction cycles. Each cycle adds an immutable version with who uploaded it, who reviewed it, when, and why; users are notified in-app when a re-upload is needed; and reviewers and users can open a per-document history and view or download any earlier version.

---

## Test Files Created for This CR

These are the backend test files that belong to this change request (paths from the project root):

| Test file | What it checks |
| --- | --- |
| `S2-partner-verification/src/test/java/com/example/lbos/service/VerificationDocumentReuploadWorkflowTest.java` | The re-upload lifecycle. |
| `S2-partner-verification/src/test/java/com/example/lbos/service/VerificationDocumentServiceImplTest.java` | Document service basics. |

---

## Main Code Location

| Item | Location |
| --- | --- |
| File | `S2-partner-verification/src/main/java/com/example/lbos/service/VerificationDocumentServiceImpl.java` |
| Place | method `uploadVerificationDocument(...)` |
| Why this is the main place | Stores a new version of a document and applies the versioning / immutability rules. |

A banner comment `CR_CHG0030047_Document_Reupload_Workflow_3239127` marks this place in the source code.
