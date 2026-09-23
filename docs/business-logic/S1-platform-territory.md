# S1 — Platform & Territory: Business Logic

Two endpoints. One is a self-contained rule (password aging); the other is a real
distributed-systems feature — a live Feign call from S1 into S2 to make a decision S1 has no
local data to make on its own.

---

## 1. Password-age policy at login

**Endpoint:** `POST /api/v1/auth/login`

**Files:**
- [S1-platform-territory/src/main/java/com/cbg/lbos/controller/AuthController.java](../../S1-platform-territory/src/main/java/com/cbg/lbos/controller/AuthController.java) — the check itself, lines 32–33 (constant) and 58–61 (enforcement)
- [S1-platform-territory/src/main/java/com/cbg/lbos/exception/PasswordExpiredException.java](../../S1-platform-territory/src/main/java/com/cbg/lbos/exception/PasswordExpiredException.java) — new exception type
- [S1-platform-territory/src/main/java/com/cbg/lbos/exception/GlobalExceptionHandler.java](../../S1-platform-territory/src/main/java/com/cbg/lbos/exception/GlobalExceptionHandler.java) — line 29–32, maps it to HTTP 423
- [S1-platform-territory/src/main/java/com/cbg/lbos/service/UserAccountService.java](../../S1-platform-territory/src/main/java/com/cbg/lbos/service/UserAccountService.java) — `createUserAccount()`/`registerCustomer()` now stamp `passwordChangedOn` at account creation

### The gap before

`AuthController.login()` checked the password hash and `accountStatus == ACTIVE` and then
issued a JWT — forever, no matter how old the credential was. `UserAccount.passwordChangedOn`
existed as a column and was only ever updated when a password was changed through
`updateUserAccount()`; it was never set when the account was first created, so on a fresh
account it stayed `null` indefinitely.

### The logic (step by step)

1. Password hash check and `ACTIVE` status check happen exactly as before (unchanged).
2. **New check**, right before token issuance:
   ```java
   if (account.getPasswordChangedOn() == null
           || Duration.between(account.getPasswordChangedOn(), OffsetDateTime.now()).toDays() > MAX_PASSWORD_AGE_DAYS) {
       throw new PasswordExpiredException("Password has expired; it must be changed before logging in");
   }
   ```
   `MAX_PASSWORD_AGE_DAYS = 90`. A `null` timestamp is treated as *already expired*, not
   as "unknown/skip the check" — this matters because it means every pre-existing account
   without a recorded password-change date is forced to re-establish that date (by changing
   its password) rather than silently bypassing the policy forever.
3. `PasswordExpiredException` → `423 LOCKED` (a distinct status from `401`, so a client can
   tell "wrong password" apart from "right password, but it's stale").
4. To make the 90-day clock actually start somewhere, `UserAccountService.createUserAccount()`
   and `registerCustomer()` now set `passwordChangedOn = OffsetDateTime.now()` at creation time,
   alongside `passwordHash`. Before this change, that field was silently left `null` for every
   newly created account until its first password change.

### Live verification

All 7 seeded demo accounts (`admin`, `manager`, `location`, `retailer1/2`, `fleetowner1`,
`customer1`) logged in successfully against the live stack — proving the check doesn't produce
false-positive lockouts, because S1's `DataSeeder` already stamps `password_changed_on = now()`
on every seeded row (`DataSeeder.java:103,108-109`).

**The "already expired" branch itself was later fired live too**, once the stack was switched to
run against a real local PostgreSQL instance instead of in-memory H2 (`scriptsstart-all.cmd /postgres`
— H2's web console 404'd on this build, but Postgres is a real, externally-connectable database,
so `psql` can reach it directly):

```sql
-- via psql against the live lbos_platform database:
UPDATE user_account SET password_changed_on = NOW() - INTERVAL '100 days'
  WHERE email = 'admin@lbos.com';
```
```
POST /api/v1/auth/login {"email":"admin@lbos.com","password":"Lbos@2026!"}
  -> 423 {"message":"Password has expired; it must be changed before logging in"}
```
The `NULL` branch was fired the same way (`password_changed_on = NULL` for a second account) and
also returned `423` with the identical message. Both accounts were restored to `NOW()` afterward
and confirmed logging in again at `200`. This is on top of the two unit tests the same change
added (`loginWithExpiredPasswordThrowsPasswordExpired`,
`loginWithNullPasswordChangedOnThrowsPasswordExpired` in `AuthControllerTest.java`, part of the
full 146/146-passing suite) — now backed by a real end-to-end run as well.

### What to say to the reviewer

> "Before this, a password never expired — the same credential worked forever from account
> creation to deletion. I added a 90-day password-age policy at the login endpoint: if
> `passwordChangedOn` is missing or older than 90 days, login is rejected with a `423 Locked`
> instead of a token. I also had to fix a real gap to make this meaningful: account creation
> never stamped `passwordChangedOn` at all, so it stayed `null` forever on a fresh account —
> now creation sets it, same as a password change does. I verified this doesn't break any
> existing seeded login (all 7 demo accounts still authenticate live), and then proved the
> lockout itself fires live too — switched the stack to a real PostgreSQL backend, backdated a
> real account's `password_changed_on` by 100 days with a plain SQL `UPDATE`, and confirmed
> login returns `423` with the exact expected message. Same result for a `NULL`
> `password_changed_on`. Restored both accounts afterward and confirmed login works again."

**If asked "why 423 and not 401?"**: 401 already means "wrong credentials" in this codebase
(`InvalidCredentialsException`). Reusing it would make an expired-but-otherwise-correct
password indistinguishable from a wrong one to the client. 423 (Locked) is the standard HTTP
status for "the resource exists and you're the right identity, but access is blocked by a
policy," which is exactly this case.

**If asked "why treat `null` as expired instead of skipping the check?"**: the alternative
(skip the check when null) would mean the policy silently never applies to any account created
before this change shipped — a much bigger loophole than a 90-day window. Treating `null` as
expired forces every such account through a password change once, which is the intended
one-time migration cost of turning on a password-age policy on an existing user base.

---

## 2. Cross-service deactivation guard

**Endpoint:** `PATCH /api/v1/location-managers/{id}/deactivate`

**Files:**
- [S1-platform-territory/src/main/java/com/cbg/lbos/service/LocationManagerServiceImpl.java](../../S1-platform-territory/src/main/java/com/cbg/lbos/service/LocationManagerServiceImpl.java) — `deactivateAssignment()` (line 107) calls `validateNoPendingReviews()` (line 114)
- [S1-platform-territory/src/main/java/com/cbg/lbos/client/S2PartnerClient.java](../../S1-platform-territory/src/main/java/com/cbg/lbos/client/S2PartnerClient.java) — new Feign client, S1's first ever
- [S1-platform-territory/src/main/java/com/cbg/lbos/client/ServiceBasicAuthFeignConfig.java](../../S1-platform-territory/src/main/java/com/cbg/lbos/client/ServiceBasicAuthFeignConfig.java) — Basic-auth credentials for calling S2's `/internal/**`
- [S1-platform-territory/src/main/java/com/cbg/lbos/LbosApplication.java](../../S1-platform-territory/src/main/java/com/cbg/lbos/LbosApplication.java) — `@EnableFeignClients` added
- Consumes: [S2-partner-verification/src/main/java/com/example/lbos/controller/InternalVerificationQueueController.java](../../S2-partner-verification/src/main/java/com/example/lbos/controller/InternalVerificationQueueController.java) — the new S2 endpoint this calls (documented fully in [S2-partner-verification.md](S2-partner-verification.md))

### The gap before

`deactivateAssignment()` did exactly one thing: `assignmentStatus = INACTIVE`, save, done. A
Location Manager who was actively assigned as the reviewer on open `VerificationQueue` items in
S2 could be pulled out of rotation with zero warning — those items would sit assigned to an
inactive account indefinitely, with no one actively working them.

### The logic (step by step)

1. `deactivateAssignment(locationManagerId)` loads the `LocationManager`, then calls
   `validateNoPendingReviews(locationManager)` **before** touching `assignmentStatus`.
2. `validateNoPendingReviews` calls the new `S2PartnerClient.getPendingReviewCount(userAccountId)`
   — a real HTTP Feign call from S1 (port 8081) to S2 (port 8082), authenticated with HTTP Basic
   against S2's shared `lbos-service` internal account (the same mechanism S2 already uses to
   call S1 elsewhere in this codebase — this endpoint category isn't behind the JWT gateway
   flow at all, it's service-to-service).
3. **Fail-closed on Feign failure**: if S2 is unreachable or errors, the guard does **not**
   let deactivation through — it throws the same `InvalidAssignmentException` with a message
   saying the check couldn't be verified. This is a deliberate choice, called out in a comment
   at `LocationManagerServiceImpl.java:118-124`: a safety check that silently no-ops when its
   dependency is down is worse than one that blocks conservatively.
4. If the response's `pendingCount() > 0`, deactivation is blocked with
   `InvalidAssignmentException` (→ HTTP `422 Unprocessable Entity`), naming exactly how many
   pending reviews are in the way.
5. Only if the count is `0` does the method proceed to actually flip the status to `INACTIVE`.

### Live verification (full round trip, live Feign call, real HTTP between two running JVMs)

```
1. Assigned a pending VerificationQueue item to the seeded Location Manager via S2's
   PATCH /api/verification-queues/{id}/assign.

2. PATCH /api/v1/location-managers/{id}/deactivate  ->  422
   {"message":"Location Manager has 1 pending verification review(s) assigned;
     reassign them before deactivating"}

3. Resolved that queue item via S2's POST .../process-result (APPROVED).

4. PATCH /api/v1/location-managers/{id}/deactivate  ->  200, assignmentStatus: "INACTIVE"

5. PATCH /api/v1/location-managers/{id}/activate    ->  200, assignmentStatus: "ACTIVE"
   (restored state)
```

This is the one endpoint in the whole set that's a genuine live distributed-systems test — two
separate Spring Boot processes, a real network call between them, blocked then unblocked based
on the live state of the *other* service's database.

### What to say to the reviewer

> "This is the endpoint I'd point to first. Deactivating a Location Manager used to be a
> one-line status flip with no awareness that they might still be the assigned reviewer on
> open verification cases in the Partner Verification service. I added a live Feign call from
> S1 into a brand-new internal endpoint on S2 — `GET /internal/v1/verification-queues/reviewer/{id}/pending-count`
> — and block the deactivation with a 422 if that count is above zero. S1 had no Feign
> infrastructure at all before this, so I had to add the dependency, the Basic-auth config, and
> `@EnableFeignClients` — this is the one place in the review where I can show a real
> cross-service call, not just in-process validation. I also made a deliberate call on failure
> mode: if S2 is unreachable, the guard fails *closed* — it blocks deactivation rather than
> assuming it's safe — since a safety check that goes quiet when its dependency is down is
> worse than one that's conservative. I ran the full live stack and proved the round trip: blocked
> at 422 while a review was pending, succeeded once it was resolved, and I re-activated the
> manager afterward to leave the demo data clean."

**If asked "why fail closed and not open?"**: the whole point of the check is that pulling a
reviewer out of rotation while they still have assigned work is the bad outcome. If S2 is down,
we genuinely don't know whether that's true — assuming "probably fine" (fail open) risks the
exact failure this feature exists to prevent. Fail-closed means the operator has to actively
retry once S2 is back, which is a much cheaper cost than silently deactivating a manager who
had 10 open reviews.
