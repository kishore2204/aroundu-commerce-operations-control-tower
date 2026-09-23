# S2 — Partner Verification: Business Logic

Both endpoints live in the same file — `VerificationQueueServiceImpl.java` — and share one
building block: a repository query that counts a reviewer's currently-open workload.

---

## 1. Workload-capped, guarded reviewer assignment

**Endpoint:** `PATCH /api/verification-queues/{id}/assign`

**Files:**
- [S2-partner-verification/src/main/java/com/example/lbos/service/VerificationQueueServiceImpl.java](../../S2-partner-verification/src/main/java/com/example/lbos/service/VerificationQueueServiceImpl.java) — `assignReviewer()`, lines 205–230; shared counter `getPendingReviewCountForReviewer()`, lines 232–236
- [S2-partner-verification/src/main/java/com/example/lbos/repository/VerificationQueueRepository.java](../../S2-partner-verification/src/main/java/com/example/lbos/repository/VerificationQueueRepository.java) — `countByReviewedByAccountIdAndVerificationStatusNotInAndIsActiveTrue(...)`
- [S2-partner-verification/src/main/java/com/example/lbos/controller/InternalVerificationQueueController.java](../../S2-partner-verification/src/main/java/com/example/lbos/controller/InternalVerificationQueueController.java) — exposes the same counter internally for S1 to consume (see [S1-platform-territory.md](S1-platform-territory.md#2-cross-service-deactivation-guard))

### The gap before

`assignReviewer(id, reviewerAccountId)` did one line of work: `existing.setReviewedByAccountId(reviewerAccountId)`,
save, done. **Zero validation** — not a terminal-status check, not a self-review check,
nothing. You could assign a reviewer to a queue item that was already `APPROVED`, or assign
someone to review their own submission.

### The logic (step by step)

Three guards run in order before the assignment is actually written:

1. **Terminal-status guard** — if `verificationStatus` is already `APPROVED` or `REJECTED`
   (the same `TERMINAL_STATUSES` set already used by `processVerificationResult`), reject with
   `InvalidVerificationTransitionException` → `409 Conflict`. A decided case shouldn't be
   re-assignable.
2. **Self-review guard** — if `reviewerAccountId` equals `existing.getSubmittedByAccountId()`,
   reject the same way. Mirrors the identical check already inside `processVerificationResult`
   (a reviewer can't decide on their own submission) — this closes the same hole one step
   earlier, at assignment time rather than decision time.
3. **Workload cap** — calls `getPendingReviewCountForReviewer(reviewerAccountId)`, which counts
   every `VerificationQueue` row where `reviewedByAccountId = this reviewer`, `isActive = true`,
   and `verificationStatus` is **not** one of `APPROVED`/`REJECTED`. If that count is `>= 15`,
   reject with `409 Conflict` — "Reviewer already has 15 or more pending verification items
   assigned; assign to someone else." This is a real capacity constraint: a single Location
   Manager's practical caseload is finite, and blind assignment had no way to express that.
4. Only if all three pass does `reviewedByAccountId` actually get set.

### Live verification

```
Self-review attempt (admin assigning admin as reviewer of admin's own submission):
  PATCH .../assign  ->  409  {"message":"A reviewer cannot decide on their own submission"}

Assigning to an already-APPROVED queue item:
  PATCH .../assign  ->  409  {"message":"VerificationQueue ... already has a final decision: APPROVED"}

Legitimate assignment to the seeded Location Manager:
  PATCH .../assign  ->  200  {"reviewedByAccountId":"30000000-...-02", ...}

Workload cap: assigned 15 queue items to one reviewer (all 200), then attempted a 16th:
  PATCH .../assign  ->  409  {"message":"Reviewer already has 15 or more pending
    verification items assigned; assign to someone else"}
```

All four cases fired exactly as designed against the live running service.

### What to say to the reviewer

> "This endpoint had no logic at all before — it was a one-line setter with no guardrails.
> I added three checks that run in sequence: you can't assign to a decided case, a reviewer
> can't be assigned to their own submission (same rule the decision endpoint already enforces,
> just moved one step earlier), and no reviewer can be handed more than 15 open items at once —
> a real workload cap using a `COUNT` query I added, not just a status check. I tested all four
> paths live against the running service, including actually pushing 15 assignments through and
> confirming the 16th gets rejected."

**If asked "why 15?"**: it's a deliberately simple, defensible ceiling — a stand-in for "a
Location Manager's practical caseload is finite," not a number derived from real operational
data (this is a training system with no real usage history to calibrate against). The point
being demonstrated is that the *capacity check exists and works*, not the exact number.

---

## 2. Repeat-offender auto-suspension

**Endpoint:** `POST /api/verification-queues/{id}/process-result`

**Files:**
- [S2-partner-verification/src/main/java/com/example/lbos/service/VerificationQueueServiceImpl.java](../../S2-partner-verification/src/main/java/com/example/lbos/service/VerificationQueueServiceImpl.java) — `processVerificationResult()`, the new block at lines 155–164, and the branch it feeds at lines 166–189
- [S2-partner-verification/src/main/java/com/example/lbos/repository/VerificationQueueRepository.java](../../S2-partner-verification/src/main/java/com/example/lbos/repository/VerificationQueueRepository.java) — `countBySubjectIdAndVerificationStatus(subjectId, "REJECTED")`

### The gap before

`processVerificationResult` already had a real state machine (terminal-status guard,
self-review guard, cascades the decision to documents and to the Retailer/FleetOwner). But every
rejection was treated identically regardless of history — a subject rejected once and a subject
rejected for the tenth time both just landed on `retailerStatus = "REJECTED"` / `profileStatus
= "REJECTED"`, with no escalation and the `suspensionReason` column (which already existed on
the entity) never once being set by any code path in the service.

### The logic (step by step)

This only runs inside the existing `REJECTED` branch, right after the current rejection is
saved and before the subject (Retailer/FleetOwner) status is written:

1. Count how many `VerificationQueue` rows already have `verificationStatus = "REJECTED"` for
   this exact `subjectId` — `countBySubjectIdAndVerificationStatus(...)`. This **includes** the
   rejection that was just saved a few lines above, so the count on the 3rd rejection is 3.
2. If `rejectionCount >= 3`: set `queue.setSuspensionReason("Auto-suspended after " + rejectionCount
   + " rejected verification attempts")` on the queue row that triggered it, and flip the
   subject-update branch below from "REJECTED" to a hard suspension instead:
   - Retailer → `retailerStatus = "SUSPENDED"`
   - FleetOwner → `profileStatus = "SUSPENDED"`, `ownerStatus = "INACTIVE"`
3. Below 3 rejections, behavior is unchanged from before — the subject just gets `REJECTED`.

### Live verification

```
Retailer2 BEFORE: retailerStatus = "PENDING"

Created and rejected 3 fresh VerificationQueue entries for Retailer2, one at a time:
  reject #1 -> 200
  reject #2 -> 200
  reject #3 -> 200

Retailer2 AFTER: retailerStatus = "SUSPENDED"
```

Flipped from `PENDING` straight to `SUSPENDED` on exactly the 3rd rejection — verified against
the live running service, real database state before/after.

### What to say to the reviewer

> "The approve/reject state machine here was already solid before I touched it — my job was to
> add a consequence for *repeated* rejection that didn't exist yet. On the 3rd rejection for
> the same subject, I now auto-suspend them (`SUSPENDED` retailer status, or `SUSPENDED`
> profile + `INACTIVE` owner status for a fleet owner) instead of leaving them in a plain
> `REJECTED` state they could just resubmit from indefinitely. I also wired up
> `suspensionReason` — a column that already existed on the entity but that no code anywhere
> in the service had ever actually set. I proved this live: created and rejected three fresh
> verification entries for the same retailer and watched their status flip from `PENDING` to
> `SUSPENDED` on exactly the third one, not the first or second."

**If asked "why 3?"**: same reasoning as the workload cap above — a small, easy-to-defend
threshold that demonstrates the pattern (count history, act on a threshold) rather than a
number backed by real fraud data, which doesn't exist in a training system.
