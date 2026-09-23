# CHG0030048 — Retailer Bulk Product Upload Capability

## 1. CR Overview

| Item | Detail |
| --- | --- |
| CR number | CHG0030048 |
| Title | Retailer Bulk Product Upload Capability |
| Purpose | Let a retailer download a template, fill in many products offline, upload the file, and create or update all of them in one operation with row-level error reporting |
| Main affected area | S3 commerce service (new bulk-upload service, controller, spreadsheet reader/writer) and the Retailer **Catalogue** screen (template links, Bulk upload button, two dialogs) |

## 2. Understanding the CR

**What was requested**

- Downloadable, predefined product template.
- Upload a completed file to create or update many products at once.
- Mandatory-field validation, duplicate detection, data-format validation, row-level error messages and an upload summary.
- Valid rows are processed; invalid rows are highlighted with detailed errors so the retailer can fix them.

**Why it was required**

A retailer with hundreds of products had to add each one through the single-product form.

**What the system now does**

```text
Download template → fill offline → upload (.xlsx / .csv)
   → rows validated → SKU checked against the retailer's existing products
   → new SKU: created        existing SKU + same data: unchanged
   → existing SKU + different data: retailer decides (Keep / Update / Skip)
   → summary popup + downloadable "rejected products" file
```

## 3. Existing Problem

- The only way to add a product was the one-at-a-time catalogue form (create/edit/duplicate/delete).
- There was no template, no bulk endpoint, no way to see which rows of a large list were wrong, and no way to update many existing products at once.

## 4. Root Cause

There was **no batch-entry layer** over the product system. The existing `POST/PATCH /api/v1/retailers/me/products` endpoints work on one product per request, and nothing parsed spreadsheets, reported row errors, or handled a SKU that already exists.

## 5. Solution

A new `BulkProductUploadService` in S3 sits **on top of** the existing product logic instead of re-implementing it:

- every row is validated with the constraints already declared on `ProductRequest`;
- products are filled through `CatalogueServiceImpl.copyFields(...)`, the same method single create/update uses;
- stock changes on existing products use the existing atomic `addStock` / `removeStock` queries;
- the retailer is resolved once and every SKU lookup is scoped to that retailer;
- categories and existing products are each loaded with **one** query, not one per row.

```text
Retailer clicks "Bulk upload" and chooses a .xlsx / .csv file
    ↓
Frontend (catalogue.component) → POST /api/v1/retailers/me/products/bulk-upload  (multipart: file)
    ↓
Gateway → S3 BulkProductUploadController.upload
    ↓
BulkProductUploadService.upload → parse → map columns → validate each row
    ↓
ProductRepository.findWithCategoryByRetailerIdAndSkuIn  (one query for existing SKUs)
    ↓
 ┌── any existing SKU with different data and no decision yet?
 │      YES → return status NEEDS_DECISIONS (nothing written) → "Existing Products Detected" popup
 │             → retailer picks Keep / Update / Skip per SKU → same file re-sent with decisions
 │      NO  → write in ONE transaction: create new, update chosen, count unchanged/skipped/rejected
    ↓
status COMPLETED → "Bulk Upload Completed" popup → optional "Download Rejected Products" (.xlsx)
```

## 6. Implementation Details

### 6.1 API

Base path `/api/v1/retailers/me/products/bulk-upload` (falls under the existing RETAILER-only rule for `/api/v1/retailers/me/products`, so no new authorization was added).

| Method & path | Purpose |
| --- | --- |
| `POST /bulk-upload` (multipart `file`, optional `decisions` JSON) | Upload; returns `NEEDS_DECISIONS` or `COMPLETED` |
| `GET /bulk-upload/template?format=xlsx\|csv` | Download the template |
| `POST /bulk-upload/rejected-report` (body `{rows}`) | Build the rejected-products `.xlsx` from the rows the upload returned |

### 6.2 Backend — `BulkProductUploadService` (S3)

**File formats.** `.xlsx` and `.csv` only, read and written with JDK-only code in `SpreadsheetSupport` (no new dependency). Other types, corrupt workbooks, missing required columns, an empty file, and more than **500 rows** are rejected up front with a clear message (`BusinessValidationException` → HTTP 422).

**Template and field mapping.** One `Column` enum drives the parser, the template and the rejected report:

| Column | Required | Rule |
| --- | --- | --- |
| SKU | Yes | 3–20 letters, digits, `-` or `_` |
| Name | Yes | 3–80 characters |
| Category | Yes | The category **name** (e.g. "Groceries"), matched case-insensitively against existing categories |
| Description | Yes | 10–300 characters |
| Unit Price | Yes | Greater than 0, max 2 decimals |
| Stock | Yes | Whole number, 0 or more |
| Weight (kg) | No | > 0, max 3 decimals; blank = 1 kg (added by CHG0030041) |
| Status | Yes | One of the product status values |
| Low Stock Threshold | No | Whole number, 0 or more |

Header names are matched by aliases and ignore case/spaces/punctuation (e.g. `unitprice` or `price`). The `.xlsx` template has a **Products** sheet (headers only) and a **Guide** sheet (column rules, current status values, and the **currently active category names**). The `.csv` template is the header row only. There are **no image columns**.

**Human-readable category.** Retailers type the category *name*. The service loads all categories once into a map keyed by lower-cased name and resolves each row from it; an unknown name gives `Category 'X' does not exist.` No category id ever appears in the file or the UI.

**SKU-based create / update.**

| Case | Result |
| --- | --- |
| SKU not found among this retailer's products | **Created** |
| SKU exists and every compared field is identical | **Unchanged** (counted, nothing written) |
| SKU exists and something differs | **Conflict** — needs the retailer's decision |
| Same SKU twice inside the file | Second occurrence rejected: `SKU 'X' appears more than once in the file (first on row N).` |

Compared fields: Product Name, Category, Price, Stock, Weight (only if supplied), Status, Description, Low Stock Threshold (only if supplied).

**Update behavior.** For `UPDATE`, every field the row supplies is applied through `copyFields`. Blank optional cells (low-stock threshold, weight) keep the current value. **Stock** is applied as a *delta* through the atomic `addStock` / `removeStock` queries, so concurrent sales cannot be overwritten. If those queries change no row (stock moved while the upload ran), the whole apply step is aborted with *"…No products were changed - please upload again."*

**Validation.** Each row is parsed (price, stock, low-stock, weight, status), then validated with the `ProductRequest` constraints; the first message per column is kept, and constraint names are turned into friendly text (e.g. *"Stock cannot be negative."*, *"Description must be between 10 and 300 characters."*). All problems of a row are combined and the failing column names are returned so the report can colour them.

**Duplicate/conflict handling.** The first call **never writes** when a conflict exists. Decisions are `UPDATE`, `KEEP`, `SKIP`:

| Decision | Effect |
| --- | --- |
| `UPDATE` | Existing product updated |
| `KEEP` | Existing product left as is; counted as unchanged |
| `SKIP` | Not processed; listed as rejected with *"Skipped at your request - the existing product 'X' was not changed."* |

**Partial success.** Valid rows are applied even if other rows are rejected. All writes happen inside one `TransactionTemplate`.

### 6.3 Response — `BulkProductUploadResponse`

`status` (`NEEDS_DECISIONS` / `COMPLETED`), `totalRows`, `conflicts` (SKU, existing name, list of field changes), `created`, `updated`, `unchanged`, `rejected`, `rejectedRows` (row number, original values, error text, failing columns). Products are identified by SKU and name; no ids are exposed.

### 6.4 Frontend

- **`catalogue.component.html`** → header shows *Template: .xlsx · .csv* links, a **Bulk upload** button (spinner while processing), an error banner, and the two dialogs.
- **`catalogue.component.ts`** → `onBulkFileChosen` → `runBulkUpload` (first call without decisions). `NEEDS_DECISIONS` opens the conflict dialog; `COMPLETED` opens the result dialog and reloads the product list. Cancelling the conflict dialog changes nothing (the file was only parsed).
- **`bulk-conflict-dialog`** ("Existing Products Detected") → one section per conflicting SKU with an existing-vs-uploaded table and three choices (Keep Existing / Update Existing / Skip). **Nothing is pre-selected**; Continue is refused (and unresolved SKUs highlighted) until every SKU has a choice.
- **`bulk-result-dialog`** ("Bulk Upload Completed") → counts of created / updated / unchanged / rejected, a headline such as *"8 created, 4 updated, 2 rejected"*, and **Download Rejected Products** only when something was rejected.
- **`catalogue.service.ts`** → `bulkUpload`, `bulkTemplate`, `bulkRejectedReport`.

### 6.5 Rejected-products file

`rejectedReport(...)` builds an `.xlsx` with all original columns plus an **Error** column; failing cells are red. The retailer can correct it and upload it again.

## 7. Execution Flow

1. **Download template** — link → `GET .../template?format=xlsx` → file saved as `product-upload-template.xlsx`.
2. **Fill offline** — one product per row; category by name; weight optional.
3. **Choose file** — the frontend sends it (first call, no decisions).
4. **Parse** — file type, workbook, row count (≤ 500) and required headers are checked. Failure → banner with the message, nothing else happens.
5. **Validate rows** — invalid rows go to `rejected`; duplicate SKUs in the file are rejected; valid rows become candidates.
6. **Look up existing SKUs** — one query for the retailer's products.
7. **Classify** — new → create; identical → unchanged; different → conflict.
8. **If conflicts and no decisions** → `NEEDS_DECISIONS`, popup, retailer chooses, same file re-sent with `decisions`.
9. **Apply** — create new products (`saveAll`), apply `UPDATE`s, count `KEEP`s, add `SKIP`s to rejected.
10. **Summary** — result popup; download the rejected file if needed.

**Alternate flows**

| Situation | What the retailer sees |
| --- | --- |
| Wrong file type (e.g. `.pdf`) | "Unsupported file type. Upload an .xlsx or .csv file." |
| Header missing a required column | "The file is missing required column(s): … Download the template…" |
| 501+ rows | "The file has more than 500 product rows. Split it…" |
| Row with bad price/unknown category | Row rejected with the exact reason; other rows still processed |
| Same SKU twice in the file | Second row rejected |
| Stock changed by a sale during the update | Apply step aborted; nothing changed; message asks to upload again |
| Cancel in the conflict popup | Nothing written |

## 8. Important Files Changed

| Layer | File | Change |
| --- | --- | --- |
| Service (S3) | `service/impl/BulkProductUploadService.java` | New — parse, validate, classify, create/update, template, rejected report |
| Service (S3) | `service/impl/SpreadsheetSupport.java` | New — JDK-only `.xlsx` reader/writer and CSV reader |
| Controller (S3) | `controller/BulkProductUploadController.java` | New — upload, template and rejected-report endpoints |
| DTO (S3) | `dto/response/BulkProductUploadResponse.java` | New — status, counts, conflicts, rejected rows |
| Service (S3) | `service/impl/CatalogueServiceImpl.java` | `copyFields` extracted so single and bulk share the same assignment |
| Repository (S3) | `repository/ProductRepository.java` | SKU lookup scoped to retailer, with category in one query |
| Exception (S3) | `exception/GlobalExceptionHandler.java` | Clear "file too large" (413) message |
| Frontend | `features/retailer/catalogue/catalogue.component.ts/.html` | Template links, Bulk upload button, upload flow |
| Frontend | `bulk-conflict-dialog.component.*`, `bulk-result-dialog.component.*` | New popups |
| Frontend | `core/services/catalogue.service.ts`, `core/models/bulk-upload.model.ts` | API calls and types |
| Tests | `BulkProductUploadServiceTest` | Row validation, conflict flow, template |

## 9. Important Code Changes

### 9.1 Columns drive template, parser and report — `S3-commerce-customer/.../service/impl/BulkProductUploadService.java`

```java
private enum Column {
    SKU("SKU", true, "Unique product code, 3-20 letters, digits, '-' or '_'.", "sku"),
    NAME("Name", true, "3-80 characters.", "name", "productname"),
    CATEGORY("Category", true, "Category NAME exactly as listed under 'Categories' below.", "category", "categoryname"),
    DESCRIPTION("Description", true, "10-300 characters.", "description"),
    PRICE("Unit Price", true, "Greater than 0, at most 2 decimal places.", "unitprice", "price"),
    STOCK("Stock", true, "Whole number, 0 or more.", "stock", "stockquantity", "initialstock"),
    WEIGHT("Weight (kg)", false, "Optional, in kilograms (kg), greater than 0. Leave blank for 1 kg.", "weightkg", "weight"),
    STATUS("Status", true, "One of the status values listed below.", "status"),
    LOW_STOCK("Low Stock Threshold", false, "Optional whole number, 0 or more.", "lowstockthreshold", "lowstock");
```

Explanation: `label` is the header text, `required` decides the "missing column" check, `rule` is printed in the template's Guide sheet, and `aliases` let differently-typed headers still match.

### 9.2 Main upload flow — same file

```java
public BulkProductUploadResponse upload(MultipartFile file, Map<String, String> decisions) {
    List<SheetRow> rows = parse(file);
    Map<Column, Integer> columns = mapColumns(rows.get(0));
    List<SheetRow> dataRows = rows.subList(1, rows.size());
    // The retailer is resolved once (one call to S2), before any transaction is opened.
    UUID retailerId = ctx.retailer().retailerId();
    return tx.execute(status -> process(retailerId, columns, dataRows, decisions == null ? Map.of() : decisions));
}
```

### 9.3 Validate, detect duplicates, one query for existing SKUs — same file

```java
Map<String, ProductCategory> categoriesByName = new HashMap<>();
for (ProductCategory category : categories.findAll()) {
    categoriesByName.put(category.getName().trim().toLowerCase(Locale.ROOT), category);
}
...
Integer earlier = firstRowOfSku.putIfAbsent(candidate.sku, row.number());
if (earlier != null) {
    rejected.add(new RejectedRow(row.number(), original,
            "SKU '" + candidate.sku + "' appears more than once in the file (first on row " + earlier + ").",
            List.of(Column.SKU.label)));
    continue;
}
...
Map<String, Product> existingBySku = new HashMap<>();
if (!candidates.isEmpty()) {
    for (Product product : products.findWithCategoryByRetailerIdAndSkuIn(retailerId,
            candidates.stream().map(candidate -> candidate.sku).toList())) {
        existingBySku.put(product.getSku().trim().toUpperCase(Locale.ROOT), product);
    }
}
```

### 9.4 New / unchanged / conflict, and the "nothing is written yet" response — same file

```java
Product existing = existingBySku.get(candidate.sku);
if (existing == null) {
    toCreate.add(candidate);
    continue;
}
List<FieldChange> differences = differences(existing, candidate);
if (differences.isEmpty()) {
    unchanged++;
} else {
    changes.add(new Change(new Conflict(candidate.sku, existing.getName(), differences), existing, candidate));
}
...
boolean undecided = changes.stream().anyMatch(change -> decisionFor(decisions, change.conflict.sku()) == null);
if (undecided) {
    return new BulkProductUploadResponse("NEEDS_DECISIONS", dataRows.size(),
            changes.stream().map(Change::conflict).toList(), 0, 0, 0, 0, List.of());
}
```

### 9.5 Create and apply decisions — same file

```java
for (Candidate candidate : toCreate) {
    Product product = new Product();
    product.setRetailerId(retailerId);
    product.setStock(candidate.request.stock());
    CatalogueServiceImpl.copyFields(product, candidate.sku, candidate.category, candidate.request);
    newProducts.add(product);
}
products.saveAll(newProducts);

int updated = 0;
for (Change change : changes) {
    String decision = decisionFor(decisions, change.conflict.sku());
    if (DECISION_KEEP.equals(decision)) {
        unchanged++;
    } else if (DECISION_SKIP.equals(decision)) {
        rejected.add(new RejectedRow(change.candidate.row.number(), change.candidate.original,
                "Skipped at your request - the existing product '" + change.existing.getName() + "' was not changed.",
                List.of()));
    } else {
        updateExisting(retailerId, change);
        updated++;
    }
}
```

### 9.6 Update fields and stock atomically — same file

```java
CatalogueServiceImpl.copyFields(existing, change.candidate.sku, change.candidate.category, effective);
products.flush(); // write the field changes before the atomic stock update runs
if (stockDelta != 0) {
    int changedRows = stockDelta > 0
            ? products.addStock(existing.getId(), retailerId, stockDelta)
            : products.removeStock(existing.getId(), retailerId, -stockDelta);
    if (changedRows == 0) {
        throw new BusinessValidationException(
                "Stock for '" + existing.getName() + "' changed while the upload was running. No products were changed - please upload again.");
    }
}
```

### 9.6b Row validation using existing constraints — same file

```java
// The existing ProductRequest constraints decide everything else (required, lengths, ranges, SKU format).
ProductRequest request = new ProductRequest(cell.get(Column.NAME), cell.get(Column.SKU),
        category == null ? -1L : category.getId(), price, stock, status,
        cell.get(Column.DESCRIPTION), lowStock, weight);
for (ConstraintViolation<ProductRequest> violation : validator.validate(request)) {
    Column column = columnFor(violation.getPropertyPath().toString());
    ...
```

```java
case "Min" -> column == Column.STOCK ? "Stock cannot be negative." : column.label + " cannot be negative.";
case "Pattern" -> "SKU must be 3-20 characters: letters, digits, '-' or '_'.";
```

### 9.7 File checks — same file

```java
if (!xlsx && !name.endsWith(".csv")) {
    throw new BusinessValidationException("Unsupported file type. Upload an .xlsx or .csv file.");
}
...
if (rows.size() - 1 > MAX_ROWS) {
    throw new BusinessValidationException("The file has more than " + MAX_ROWS
            + " product rows. Split it into smaller files (maximum " + MAX_ROWS + " rows per upload).");
}
```

```java
throw new BusinessValidationException("The file is missing required column(s): " + String.join(", ", missing)
        + ". Download the template to see the expected columns.");
```

### 9.8 Controller — `S3-commerce-customer/.../controller/BulkProductUploadController.java`

```java
@RestController
@RequestMapping("/api/v1/retailers/me/products/bulk-upload")
public class BulkProductUploadController {
...
@PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
public ApiResponse<BulkProductUploadResponse> upload(
        @RequestParam("file") MultipartFile file,
        @RequestParam(value = "decisions", required = false) String decisions,
        HttpServletRequest request) {
    BulkProductUploadResponse result = service.upload(file, parseDecisions(decisions));
    ...
}

@GetMapping("/template")
public ResponseEntity<byte[]> template(@RequestParam(defaultValue = "xlsx") String format) {

@PostMapping("/rejected-report")
public ResponseEntity<byte[]> rejectedReport(@RequestBody RejectedReportRequest body) {
```

### 9.9 Response model — `S3-commerce-customer/.../dto/response/BulkProductUploadResponse.java`

```java
public record BulkProductUploadResponse(
        String status,
        int totalRows,
        List<Conflict> conflicts,
        int created,
        int updated,
        int unchanged,
        int rejected,
        List<RejectedRow> rejectedRows) {

    public record FieldChange(String field, String existing, String uploaded) { }
    public record Conflict(String sku, String existingName, List<FieldChange> changes) { }
    public record RejectedRow(int rowNumber, Map<String, String> values, String error, List<String> errorFields) { }
```

### 9.10 Frontend upload flow — `frontend/src/app/features/retailer/catalogue/catalogue.component.ts`

```ts
private runBulkUpload(decisions?: Record<string, BulkDecision>): void {
  if (!this.bulkFile) return;
  this.bulkBusy.set(true);
  this.bulkError.set(null);
  this.catalogueService.bulkUpload(this.bulkFile, decisions).subscribe({
    next: (result) => {
      this.bulkBusy.set(false);
      if (result.status === 'NEEDS_DECISIONS') {
        this.bulkConflicts.set(result.conflicts);
        return;
      }
      this.bulkConflicts.set(null);
      this.bulkFile = null;
      this.bulkResult.set(result);
      this.load();
    },
    error: (err) => {
      this.bulkBusy.set(false);
      this.bulkConflicts.set(null);
      this.bulkFile = null;
      this.bulkError.set(extractErrorMessage(err, 'The file could not be uploaded. Please try again.'));
    },
  });
}

onConflictsConfirmed(decisions: Record<string, BulkDecision>): void {
  this.runBulkUpload(decisions);
}

/** Cancelling changes nothing - the file was only parsed, never applied. */
onConflictsCancelled(): void {
  this.bulkConflicts.set(null);
  this.bulkFile = null;
}
```

### 9.11 Conflict dialog rules — `frontend/.../bulk-conflict-dialog.component.ts`

```ts
readonly options: { value: BulkDecision; label: string; hint: string }[] = [
  { value: 'KEEP', label: 'Keep Existing', hint: 'Ignore the uploaded changes' },
  { value: 'UPDATE', label: 'Update Existing', hint: 'Apply the uploaded values' },
  { value: 'SKIP', label: 'Skip', hint: 'Do not process; listed as rejected' },
];

continue(): void {
  if (this.busy) return;
  if (this.unresolvedCount() > 0) {
    this.attemptedContinue.set(true);
    return;
  }
  this.confirmed.emit(this.choices());
}
```

### 9.12 API calls — `frontend/src/app/core/services/catalogue.service.ts`

```ts
bulkUpload(file: File, decisions?: Record<string, BulkDecision>): Observable<BulkUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (decisions) formData.append('decisions', JSON.stringify(decisions));
  return this.http
    .post<ApiResponse<BulkUploadResult>>('/api/v1/retailers/me/products/bulk-upload', formData)
    .pipe(map(unwrap));
}

bulkTemplate(format: 'xlsx' | 'csv'): Observable<Blob> {
  return this.http.get('/api/v1/retailers/me/products/bulk-upload/template', {
    params: new HttpParams().set('format', format),
    responseType: 'blob',
  });
}

bulkRejectedReport(rows: BulkRejectedRow[]): Observable<Blob> {
  return this.http.post('/api/v1/retailers/me/products/bulk-upload/rejected-report', { rows }, { responseType: 'blob' });
}
```

### 9.13 Result popup — `frontend/.../bulk-result-dialog.component.ts`

```ts
get headline(): string {
  const { created, updated, unchanged, rejected } = this.result;
  const parts = [
    created ? `${created} created` : '',
    updated ? `${updated} updated` : '',
    unchanged ? `${unchanged} unchanged` : '',
    rejected ? `${rejected} rejected` : '',
  ].filter(Boolean);
  const text = parts.join(', ');
  return !rejected && created && !updated && !unchanged ? `${text} successfully` : text;
}
```

## 10. Before vs After

| Area | Before | After |
| --- | --- | --- |
| Adding products | One at a time through the form | Many per file (up to 500 rows) |
| Template | None | `.xlsx` (Products + Guide sheets, live categories/statuses) and `.csv` |
| Existing SKU | Had to be edited by hand | Compared; retailer chooses Keep / Update / Skip; never overwritten silently |
| Validation | Only on the single form | Every row validated with the same `ProductRequest` rules, with friendly messages |
| Errors | — | Row number + reason; downloadable red-highlighted rejected file |
| Category | Selected from a dropdown | Typed by name; resolved from one preloaded map |
| Performance | — | One category query, one existing-SKU query, one `saveAll`, one transaction |
| Security | — | Same RETAILER-only rule; lookups scoped to the calling retailer |

## 11. Testing

| # | Scenario | Expected |
| --- | --- | --- |
| 1 | Download `.xlsx` template | Products sheet with 9 headers; Guide sheet lists rules, status values and active categories |
| 2 | Download `.csv` template | One header line |
| 3 | Upload 3 valid new products | "3 created successfully"; products appear in the catalogue |
| 4 | Upload a `.pdf` | "Unsupported file type…" |
| 5 | Upload a file without the SKU column | "missing required column(s): SKU…" |
| 6 | Upload 501 rows | "more than 500 product rows" |
| 7 | Row with unknown category | Row rejected: *Category 'X' does not exist.* Other rows created |
| 8 | Row with price `-5`, stock `abc` | Both errors listed in one row message |
| 9 | Same SKU on rows 2 and 5 | Row 5 rejected as duplicate |
| 10 | Existing SKU, identical data | Counted as unchanged, no popup |
| 11 | Existing SKU, different price/stock | "Existing Products Detected" popup with an existing-vs-uploaded table |
| 12 | Continue without choosing | Popup refuses and highlights the unresolved SKU |
| 13 | Choose Update | Product updated; stock changed by the difference; result shows "updated" |
| 14 | Choose Keep / Skip | Keep → unchanged; Skip → appears in rejected list |
| 15 | Cancel the popup | Nothing changed |
| 16 | Result with rejected rows | "Download Rejected Products" gives an `.xlsx` with Error column and red cells; correct and re-upload |
| 17 | Another retailer's SKU with the same code | Not affected (lookup is scoped to the caller) |

Automated: `BulkProductUploadServiceTest` covers the template header, weight cases, duplicate SKUs, conflict/decision flow and rejected rows.

## 12. Final Result

Retailers can maintain their whole catalogue from a spreadsheet: download the template, upload it, resolve any clash with existing SKUs explicitly, get a clear per-row error report, and re-upload only the corrected rows. The feature reuses the existing product rules, so bulk and single-product entry always behave the same.
