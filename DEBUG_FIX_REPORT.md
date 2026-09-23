# AroundU Debug Rectification Report

Source used: `tcs2-main (4).zip`

This package keeps the existing project structure and database scripts. No SQL/database script was modified.

## Requested fixes

1. **Admin user phone validation** — Admin account form now requires 10–15 numeric digits and shows an inline validation message. S1 already enforces the same server-side validation.
2. **Admin zone creation** — Confirmed Admin `Territory` screen can select a city and create a zone through the existing territory API; shared territory UI remains available under the Admin portal.
3. **Audit logs** — Added a frontend audit interceptor for successful portal mutations and allowed authenticated roles to append immutable S6 audit records while keeping audit-log reads staff controlled.
4. **Terms and Conditions popup** — Signup Terms and Conditions now opens in a modal with Close/Accept actions.
5. **Customer address State -> City -> Zone** — Address form now selects State first, filters City by State, then loads Zone by City.
6. **Retailer onboarding State -> City -> Zone** — Retailer onboarding now follows State -> City -> Zone and requires zone selection.
7. **Retailer onboarding unnecessary message** — Removed the old metadata/file-upload implementation note from the customer-facing screen.
8. **Retailer 4 mandatory documents** — Step 2 is now a fixed table containing GST Certificate, PAN Card, Business License and Address Proof. All four are mandatory on first submission.
9. **Remove Assign to me** — Location Manager verification detail no longer presents the Assign to me action.
10. **Duplicate/phantom verification document** — Real file upload no longer creates a second non-previewable placeholder row. Reviewer queue returns one current document per document type and prefers the actual uploaded file for legacy duplicates.
11. **Verification queue discoverability** — Queue includes an explicit `Review ->` action and guidance text so the reviewer knows how to open an application.
12. **Individual document rejection/resubmission** — Reviewer sees an expected-document checklist by subject type, can approve each document or request re-upload with a mandatory reason. The submitter sees a resubmission message and only rejected documents need replacement. Final application approval stays disabled until every required current document is approved. Current expected sets: Retailer 4, Fleet Owner 2, Driver 1, Vehicle 1.
13. **Multiple-click duplicate submission protection** — Added in-flight guards/disabled actions to retailer/fleet verification, checkout/order placement, logistics booking, driver/vehicle submission and related flows. Active verification queues are reused for repeated driver/vehicle verification creation requests.
14. **Retailer product images** — Retailer can select multiple product images (up to 8). Images are stored outside the database under configurable filesystem storage. The first image is used on customer product cards and the full gallery is shown on product details.
15. **Verification queue subject/details** — Retailer/Fleet Owner names, Driver names and Vehicle registration/make/model are shown. Driver/Vehicle rows also show owning fleet. Detail screen loads the entered Retailer/Fleet Owner/Driver/Vehicle information for cross-checking against documents.
16. **S3 application.yml -> application.properties** — S3 configuration was converted to `application.properties`; `application.yml` was removed.
17. **Checkout total automatic** — Removed `Calculate totals`; checkout automatically prepares totals for the default delivery address and shows loading/summary inline.
18. **Fleet assignment context** — Assignment cards now show pickup, drop, distance, load information and per-order vehicle/driver selection. Retail orders use the source data available in the project; product weight is not stored, so retail load is clearly labelled as an approximate UI estimate based on item units rather than inventing a database weight value.
19. **Closed Retailer product visibility** — Customer product discovery/details now fail closed unless S2 confirms the Retailer is currently open; closed-store products are not exposed as orderable products.
20. **Customer cancellation after trip assignment** — S4 now blocks cancellation whenever a trip already exists or the order has reached vehicle-assigned/in-transit/delivered stages. Customer UI only offers cancellation in pre-assignment stages.

## Source-level validation performed

- TypeScript parser check: **PASS** — 212 TS files parsed.
- Frontend relative-import resolution: **PASS** — all relative TS imports resolve to project files.
- Java parser check: **PASS** — 554 Java files parsed.
- Database/SQL integrity: **PASS** — all original SQL/database files are byte-for-byte unchanged.
- S3 configuration conversion: **PASS** — `application.properties` present; `application.yml` removed.

## Environment limitation

A full Angular production build and Maven dependency compile could not be completed in this isolated environment because the uploaded ZIP intentionally does not include `node_modules`/Maven artifacts and external package repositories are unreachable here. No generated dependencies have been included in this ZIP. Run the normal project dependency install/build commands in your connected development environment before deployment.
