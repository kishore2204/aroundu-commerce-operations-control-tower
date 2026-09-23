# INC0010084 — Product Category & Tax Synchronization

## 1. Ticket Overview

| Field | Details |
| --- | --- |
| Ticket | INC0010084 |
| Category | Synchronization |
| Issue | The Admin can create a product category and configure the applicable tax, but the new category is not shown in the category list when a Retailer adds a product. Active categories created by the Admin, with their tax details, must be available to Retailers. |
| Main Area | S3 (product categories, products, checkout), S6 (tax configuration and calculation), Angular Admin Finance and Retailer Catalogue screens |
| Purpose | Retailers always see the current active categories, and each category has a real, category-based tax rule that checkout uses. |

---

## 2. Understanding the Ticket

**Requested:** whatever active category the Admin creates must appear for a Retailer adding a product, together with the tax that applies to it.

**Why the two halves matter in this project:**
- **Category** lives in **S3** (`product_categories`): `ProductCategory` with an `ACTIVE`/`INACTIVE` status.
- **Tax** lives in **S6** (`tax_configuration`): `TaxConfiguration`. S3 and S6 are separate services with separate data; they must connect through an id and an API, never through a shared table.

**What the system should do:**
- Retailer "Add product" always lists the current ACTIVE categories (and only those are selectable; the backend enforces it).
- A tax rule is created **for a product category** (chosen from a dropdown), not typed as free text.
- At checkout each product is taxed with the rule of its own category for the customer's state; a mixed basket is taxed category by category.
- If a category has no applicable tax rule, checkout is blocked with a clear message — no hidden default rate.
- Old orders are not recalculated; multi-retailer order/payment splitting stays as it was.

---

## 3. Existing Problem

```text
Admin creates category "Toys" (ACTIVE)          Admin creates tax rule "Toys" (typed text)
        ↓                                               ↓
S3 product_categories                            S6 tax_configuration.tax_category_name = "Toys"
        ↓                                               ↓ (no link)
Retailer opens Add Product → old/cached list     Checkout → S6 picks "the latest active rule"
        ↓                                        or 18% default, category ignored
"Toys" missing
```

1. **Retailer could not see the new category** — the list was old.
2. **Tax was never tied to a category** — tax rules were free-text names; checkout asked S6 for one flat rate.

---

## 4. Root Cause

Confirmed in the source:

**Why the new category was missing for the Retailer**
1. `CategoryService.active()` (Angular) wrapped the call in a `TtlCache` of **5 minutes** (a shared "reference data" cache).
2. `catalogue.component.ts` loaded the categories **once in `ngOnInit`** through that cache, so a category created after the page (or the cache) was loaded did not appear until the cache expired and the page was reopened.
3. S3 `CategoryServiceImpl.active()` was `search("","ACTIVE",0,100).items()` — only the **first 100** active categories.
4. S3 product create/update (`CatalogueServiceImpl.apply`) looked the category up with `findById` and did **not** check its status, so the "only active categories" rule existed only in the list, not in the backend.

**Why the tax was not category-specific**
5. S6 `TaxConfiguration` had only `taxCategoryName` (a typed string), `stateId`, cgst/sgst and dates — **no product category id**. The Admin form asked for a "Category name" text box.
6. S6 `InternalTaxCalculationController` used `findFirstByActiveTrueOrderByEffectiveFromDesc()` — a single flat rate — and **fell back to 18%** when none existed. It ignored the category and the customer's state.
7. S3 `CheckoutServiceImpl` built each tax item as `new TaxItemRequest(item.productId(), null, ...)` — the category was always `null`.
8. S6 `CatalogServiceClient` declared `getProductCategory`/`getProduct` as returning the plain record, but S3's controllers return their payload wrapped in `ApiResponse` (`{timestamp, correlationId, message, data}`). Read from the code, the record's fields (`id`, `name`, …) would not match the top-level JSON, so the category lookup S6 needs for validation could not have worked as written (this was found by reading the two sides; it was not observed at runtime).

---

## 5. Solution

### A. Category ↔ tax linkage (S6 ↔ S3, by id only)

```text
Admin
  ↓
Chooses a Product Category (dropdown of ACTIVE categories from S3)
  ↓
Configures tax (CGST/SGST, state, dates)  →  POST /api/tax-configurations { productCategoryId, … }
  ↓
S6 validates the category through the S3 catalog client (exists + ACTIVE)
  ↓
Save  tax_configuration.product_category_id  (+ category name as display snapshot)
```

`productCategoryId` is a plain column: **no JPA relation, no copy of the category table**.

### B. Retailer sees fresh active categories

```text
Retailer opens page / clicks Add product / Edit product
  ↓
CategoryService.activeFresh()  (clears the cache, asks S3)
  ↓
GET /api/v1/product-categories/active  → every ACTIVE category, sorted by name
  ↓
Dropdown shows the current list
  ↓
Save → S3 rejects a non-active category
```

### C. Checkout uses the category's tax

```text
Customer checkout
  ↓
S3 gets each cart line's category id (ONE query)
  ↓
POST /api/v1/internal/tax-calculations  { cityId, items[productId, productCategoryId, quantity, unitPrice] }   (per retailer)
  ↓
S6: city → state (S1 territory data, cached)
  ↓
S6: one query for all categories: active + in force today + (state or nationwide)
  ↓
per-line tax = qty × price × (cgst + sgst) / 100
  ↓
Missing rule → 409 "No applicable tax configuration found for product category X" → checkout blocked
  ↓
Tax flows: Checkout breakdown → Order taxAmount → Payment → Order details
```

---

## 6. Implementation Details

### Frontend
- **`core/services/category.service.ts`** — new `activeFresh()` (clears the `TtlCache` then reloads). The cached `active()` stays for the customer-facing pages (home, product list).
- **`features/retailer/catalogue/catalogue.component.ts/.html`** — categories load through `activeFresh()` on page open and again in `startCreate()` and `startEdit()`. When editing a product whose category has since been switched off, that category stays as a disabled `Current category (no longer active)` option so the product keeps it, but it cannot be newly chosen.
- **`features/operations/finance/finance.component.ts/.html`** — the tax form now has a **Product category** `<select>` (active categories, id-based) instead of the "Category name" text field; opening the form reloads the categories (`toggleTaxForm()`); the table shows the category name (live name if known, else the stored name) and a `No category linked` badge for legacy rules.
- **`core/models/tax-configuration.model.ts`** — `productCategoryId` added; the create request carries `productCategoryId`.

### S3 (commerce)
- **`CategoryServiceImpl.active()`** — now `repo.findByStatusOrderByNameAsc(CategoryStatus.ACTIVE)`: every active category, no 100-item cap.
- **`CatalogueServiceImpl.apply()`** — rejects a non-ACTIVE category on create/update (`Category '…' is not active - choose an active category`); an unchanged existing category is allowed.
- **`ProductRepository.findCategoryRefsByProductIds`** + record **`ProductCategoryRef`** — one JPQL query returning `(productId, categoryId)` for all cart products; no N+1.
- **`TaxItemRequest`** — field renamed to `productCategoryId`.
- **`CheckoutServiceImpl`** — sends productId, productCategoryId, quantity, unitPrice per retailer; a rejection from S6 (HTTP 409/422) is turned into a `BusinessValidationException` with S6's message; a `null` tax result no longer silently becomes 0 — checkout is blocked.

### S6 (finance)
- **`TaxConfiguration`** — new `Long productCategoryId` column (`ddl-auto=update` adds it as nullable); `taxCategoryName` is now only a display snapshot.
- **`TaxConfigurationRequest`** — `@NotNull Long productCategoryId`; controller uses `@Valid`.
- **`TaxConfigurationServiceImpl`** — `requireActiveCategory()` (S3 client: not found → `Product category not found`; not ACTIVE → `Product category is not active`), stores the category's name, and `requireNoOverlap()` rejects two overlapping active rules for the same category + state.
- **`TaxConfigurationCategoryLinker`** — migrates legacy rows: a row without `productCategoryId` whose old name matches an active category name (case-insensitive) is linked to that category id. Runs at startup, when the tax list is read, and once before checkout is blocked for a missing rule. Nothing is deleted; unmatched rows stay and show `No category linked`.
- **`CatalogServiceClient`** — raw calls return a `CatalogEnvelope<T>` and default methods `getProduct`, `getProductCategory`, `getActiveProductCategories` unwrap `data`.
- **`TerritoryServiceClient` + `CityStateResolver`** — reads S1's active-city list (`/internal/v1/territories/cities`) and caches city → state for 30 minutes (refresh at most once a minute when a city is unknown; last good data is used if S1 is unreachable).
- **`TaxCalculationService`** + **`TaxCalculationDtos`** — the calculation described in 5C. **`InternalTaxCalculationController`** now only delegates.
- **`TaxConfigurationRepository.findApplicable`** — the single query for a whole basket.
- **`DataSeeder`** — seeds one Tamil Nadu tax rule per demo category name (linked to the category ids by the linker), so the demo data works.

---

## 7. Execution Flow

### Admin side
```text
1. Admin creates a product category in S3 (status ACTIVE)
        ↓
2. Admin → Finance → Tax configurations → New tax rule
        ↓
3. Form opens; activeFresh() loads the current ACTIVE categories
        ↓
4. Admin picks the category, CGST/SGST and optional state; submits
        ↓
5. POST /api/tax-configurations { productCategoryId, cgst, sgst, stateId, … }
        ↓
6. S6: state active? → S3 category exists and ACTIVE? → no overlapping active rule?
        ↓
7. Saved with productCategoryId (+ category name)
```

### Retailer side
```text
1. Retailer opens My Catalogue → Add product
        ↓
2. startCreate() → activeFresh() → GET /api/v1/product-categories/active
        ↓
3. S3 returns every ACTIVE category
        ↓
4. Dropdown shows the new category
        ↓
5. Save → CatalogueServiceImpl.apply(): category must be ACTIVE → product stores the category
```

### Checkout
```text
1. Customer proceeds to checkout with an address (city)
        ↓
2. S3 CheckoutServiceImpl groups cart lines by retailer
        ↓
3. One query maps productId → categoryId for all lines
        ↓
4. Per retailer: POST /api/v1/internal/tax-calculations with productCategoryId per line
        ↓
5. S6 resolves state from the city, loads applicable rules in one query
        ↓
6. All categories covered → per-line tax → response (taxAmount)
   Some category missing → 409 "No applicable tax configuration found for product category …"
        ↓
7. S3 blocks checkout with that message, or continues with the tax
        ↓
8. Breakdown tax → order taxAmount → payment total → order details
```

**Alternate flows:** S1 unreachable and no cached cities → the calculation fails and checkout returns a service-unavailable error; a product with no category → `Product … has no product category, so its tax cannot be calculated`; a category switched off → not selectable for new products/rules, existing products keep it.

---

## 8. Important Files Changed

| Layer | File | Change |
| --- | --- | --- |
| Frontend | `core/services/category.service.ts` | `activeFresh()` |
| Frontend | `features/retailer/catalogue/catalogue.component.ts/.html` | fresh categories; keep inactive current category |
| Frontend | `features/operations/finance/finance.component.ts/.html` | category dropdown, table labels |
| Frontend | `core/models/tax-configuration.model.ts` | `productCategoryId` |
| S3 Service | `service/impl/CategoryServiceImpl.java` | all ACTIVE categories |
| S3 Service | `service/impl/CatalogueServiceImpl.java` | reject non-active category |
| S3 Service | `service/impl/CheckoutServiceImpl.java` | category in tax request; block on missing tax |
| S3 Repository | `ProductRepository`, `ProductCategoryRepository`, `ProductCategoryRef` | one-query category lookup; active list |
| S3 DTO | `dto/client/finance/TaxItemRequest.java` | `productCategoryId` |
| S6 Entity/DTO | `TaxConfiguration`, `TaxConfigurationRequest`, `TaxCalculationDtos` | category id; calculation contract |
| S6 Service | `TaxConfigurationServiceImpl`, `TaxCalculationService`, `TaxConfigurationCategoryLinker`, `CityStateResolver` | validation, migration, calculation, state cache |
| S6 Repository | `TaxConfigurationRepository` | `findApplicable`, category lookups |
| S6 Clients | `CatalogServiceClient`, `TerritoryServiceClient`, `CatalogEnvelope` | envelope unwrapping; S1 city list |
| S6 Controller | `TaxConfigurationController`, `InternalTaxCalculationController` | `@Valid`; delegate to service |
| S6 Seed | `seed/DataSeeder.java` | per-category demo rules |

---

## 9. Important Code Changes

**File:** `frontend/src/app/core/services/category.service.ts`
**Purpose:** bypass the 5-minute cache where freshness matters.

```ts
activeFresh(): Observable<ProductCategory[]> {
  this.activeCategories.clear();
  return this.active();
}
```

---

**File:** `frontend/src/app/features/retailer/catalogue/catalogue.component.ts`
**Purpose:** Retailer always reads fresh categories.

```ts
/** Categories are read from the server every time (never the shared cache): a category the admin just added or
 *  switched off must show up - or disappear - the next time the retailer opens the product form. */
private loadCategories(): void {
  this.categoryService.activeFresh().subscribe({ next: (c) => this.categories.set(c), error: () => {} });
}

startCreate(): void {
  this.loadCategories();
  ...
}
```

Before, `ngOnInit` called `this.categoryService.active()` once (cached 5 minutes). `startEdit()` also calls `loadCategories()`.

---

**File:** `S3-commerce-customer/src/main/java/com/lbos/commercecustomer/service/impl/CategoryServiceImpl.java`

```java
// before
public List<CategoryResponse> active(){return search("","ACTIVE",0,100).items();}
// after
public List<CategoryResponse> active(){return repo.findByStatusOrderByNameAsc(CategoryStatus.ACTIVE).stream().map(map::category).toList();}
```

---

**File:** `S3-commerce-customer/.../service/impl/CatalogueServiceImpl.java` (`apply`)
**Purpose:** enforce "only ACTIVE" in the backend.

```java
var category=cats.findById(r.categoryId()).orElseThrow(()->new ResourceNotFoundException("Category not found"));
boolean unchangedCategory=product.getCategory()!=null&&category.getId().equals(product.getCategory().getId());
if(category.getStatus()!=com.lbos.commercecustomer.enums.CategoryStatus.ACTIVE&&!unchangedCategory)
    throw new BusinessValidationException("Category '"+category.getName()+"' is not active - choose an active category");
copyFields(product,sku,category,r);
```

---

**File:** `S3-commerce-customer/.../repository/ProductRepository.java`
**Purpose:** category of every cart product in one query.

```java
@Query("select new com.lbos.commercecustomer.repository.ProductCategoryRef(p.id, p.category.id) from Product p where p.id in :ids")
List<ProductCategoryRef> findCategoryRefsByProductIds(@Param("ids") Collection<Long> ids);
```

---

**File:** `S3-commerce-customer/.../service/impl/CheckoutServiceImpl.java`
**Purpose:** send the category and block checkout when tax cannot be determined.

```java
Map<Long, Long> categoryByProduct = products.findCategoryRefsByProductIds(productIds).stream()
        .collect(Collectors.toMap(ProductCategoryRef::productId, ProductCategoryRef::categoryId, (a, b) -> a));
...
var taxItems = retailerItems.stream()
        .map(item -> new TaxItemRequest(item.productId(), categoryByProduct.get(item.productId()), item.quantity(), item.unitPrice()))
        .toList();
BigDecimal tax = calculateTax(customer.getId(), address.getCityId(), taxItems).taxAmount();
```

```java
private TaxCalculationResponse calculateTax(UUID customerId, UUID cityId, List<TaxItemRequest> taxItems) {
    TaxCalculationResponse result;
    try {
        result = feign.call("lbos-finance", () -> finance.tax(new TaxCalculationRequest(customerId, cityId, taxItems)));
    } catch (ExternalServiceUnavailableException failure) {
        if (failure.getCause() instanceof FeignException rejected && (rejected.status() == 409 || rejected.status() == 422)) {
            throw new BusinessValidationException(taxRejectionMessage(rejected), rejected);
        }
        throw failure;
    }
    if (result == null || result.taxAmount() == null) {
        throw new BusinessValidationException("Tax could not be calculated for this order, so checkout cannot continue");
    }
    return result;
}
```

Before: `new TaxItemRequest(item.productId(), null, ...)` and `taxResult == null ? BigDecimal.ZERO : ...` (silent zero).

---

**File:** `S6-finance-support/.../entity/TaxConfiguration.java`
**Purpose:** cross-service reference by id.

```java
/** The S3 product category this rate applies to - a cross-service reference by id only (no JPA relation, no copy
 *  of the category table). Null only on legacy rows that have not been linked to a category yet. */
private Long productCategoryId;
/** Display snapshot of the category name (and the original free-text name of legacy rows). Not authoritative: the
 *  rate is found through productCategoryId. */
private String taxCategoryName;
```

---

**File:** `S6-finance-support/.../service/TaxConfigurationServiceImpl.java`
**Purpose:** validate the category through S3 when a rule is saved.

```java
private ProductCategoryResponse requireActiveCategory(Long productCategoryId) {
    if (productCategoryId == null) throw new BusinessRuleException("Product category is required");
    ProductCategoryResponse category;
    try { category = catalogServiceClient.getProductCategory(productCategoryId); }
    catch (feign.FeignException.NotFound notFound) { throw new BusinessRuleException("Product category not found"); }
    if (category == null || category.id() == null) throw new BusinessRuleException("Product category not found");
    if (!"ACTIVE".equalsIgnoreCase(category.status())) throw new BusinessRuleException("Product category is not active");
    return category;
}
...
ProductCategoryResponse category = requireActiveCategory(request.productCategoryId());
requireNoOverlap(request, excludingId);
entity.setProductCategoryId(category.id()); entity.setTaxCategoryName(category.name());
```

---

**File:** `S6-finance-support/.../repository/TaxConfigurationRepository.java`
**Purpose:** one query for a whole basket.

```java
@Query("select t from TaxConfiguration t where t.productCategoryId in :categoryIds and t.active = true "
        + "and (t.stateId = :stateId or t.stateId is null) "
        + "and (t.effectiveFrom is null or t.effectiveFrom <= :on) and (t.effectiveTo is null or t.effectiveTo >= :on)")
List<TaxConfiguration> findApplicable(@Param("categoryIds") Collection<Long> categoryIds, @Param("stateId") UUID stateId, @Param("on") LocalDate on);
```

---

**File:** `S6-finance-support/.../service/TaxCalculationService.java`
**Purpose:** the single tax calculation; no default rate.

```java
UUID stateId = cityStateResolver.stateOf(request.cityId())
        .orElseThrow(() -> new BusinessRuleException("The state of the delivery city could not be determined, so tax cannot be calculated"));

Set<Long> categoryIds = items.stream().map(TaxItemRequest::productCategoryId).collect(Collectors.toCollection(LinkedHashSet::new));
Map<Long, TaxConfiguration> applicable = applicableConfigurations(categoryIds, stateId, today);
if (!applicable.keySet().containsAll(categoryIds) && categoryLinker.linkLegacyConfigurations()) {
    applicable = applicableConfigurations(categoryIds, stateId, today); // legacy rows were just linked to their categories
}
...
if (!missing.isEmpty()) {
    throw new BusinessRuleException("No applicable tax configuration found for product category "
            + missing.stream().map(this::categoryLabel).collect(Collectors.joining(", ")));
}
...
BigDecimal taxable = item.unitPrice().multiply(BigDecimal.valueOf(item.quantity()));
BigDecimal tax = taxable.multiply(cgst.add(sgst)).divide(HUNDRED, 2, RoundingMode.HALF_UP);
```

A state-specific rule beats a nationwide (no-state) rule of the same category (`applicableConfigurations` orders by state match, then latest `effectiveFrom`). Each line uses its own category's rate, so mixed baskets are taxed per category. Before, `InternalTaxCalculationController` used `findFirstByActiveTrueOrderByEffectiveFromDesc()` and `.orElse(DEFAULT_GST_PERCENT)` (18%).

---

**File:** `S6-finance-support/.../service/TaxConfigurationCategoryLinker.java`
**Purpose:** migrate old typed-name rules without deleting anything.

```java
Map<String, Long> categoryIdByName = new HashMap<>();
for (ProductCategoryResponse category : catalogServiceClient.getActiveProductCategories()) {
    if (category.id() != null && category.name() != null) categoryIdByName.putIfAbsent(normalize(category.name()), category.id());
}
for (TaxConfiguration configuration : unlinked) {
    Long categoryId = configuration.getTaxCategoryName() == null ? null : categoryIdByName.get(normalize(configuration.getTaxCategoryName()));
    if (categoryId != null) {
        configuration.setProductCategoryId(categoryId);
        taxConfigurationRepository.save(configuration);
    }
}
```

---

**File:** `S6-finance-support/.../integration/client/CatalogServiceClient.java`
**Purpose:** S3 wraps responses in `ApiResponse`; unwrap `data`.

```java
@GetMapping("/api/v1/product-categories/{categoryId}") CatalogEnvelope<ProductCategoryResponse> fetchProductCategory(@PathVariable("categoryId") Long categoryId);
@GetMapping("/api/v1/product-categories/active") CatalogEnvelope<List<ProductCategoryResponse>> fetchActiveProductCategories();

default ProductCategoryResponse getProductCategory(Long categoryId) {
    CatalogEnvelope<ProductCategoryResponse> envelope = fetchProductCategory(categoryId);
    return envelope == null ? null : envelope.data();
}
```

---

**File:** `S6-finance-support/.../service/CityStateResolver.java`
**Purpose:** city → state with a light cache.

```java
private static final Duration TTL = Duration.ofMinutes(30);
private static final Duration MIN_REFRESH_INTERVAL = Duration.ofMinutes(1);
...
public Optional<UUID> stateOf(UUID cityId) {
    if (cityId == null) return Optional.empty();
    if (loadedAt.plus(TTL).isBefore(Instant.now())) refresh();
    UUID stateId = stateByCity.get(cityId);
    if (stateId == null && loadedAt.plus(MIN_REFRESH_INTERVAL).isBefore(Instant.now())) {
        refresh();
        stateId = stateByCity.get(cityId);
    }
    return Optional.ofNullable(stateId);
}
```

---

**File:** `frontend/src/app/features/operations/finance/finance.component.html`
**Purpose:** category dropdown instead of typed name.

```html
<label class="form-label req-mark">Product category</label>
<select class="select" formControlName="productCategoryId">
  <option [ngValue]="null" disabled>Select a product category</option>
  @for (c of categories(); track c.id) {
    <option [ngValue]="c.id">{{ c.name }}</option>
  }
</select>
```

---

## 10. Before vs After

| Area | Before | After |
| --- | --- | --- |
| Retailer category list | 5-min cache, loaded once, first 100 only | Fresh on open/add/edit, all ACTIVE categories |
| Non-active category on a product | Accepted by backend | Rejected (unchanged existing category kept) |
| Tax rule key | Typed `taxCategoryName` | `productCategoryId` (S3 id) via dropdown |
| Rule validation | none | category exists + ACTIVE (via S3), no overlap |
| Checkout tax request | category `null` | productId, productCategoryId, quantity, unitPrice |
| Rate selection | one latest flat rate, 18% default | by category + customer state + active + effective date |
| Mixed basket | one rate for everything | each line by its own category |
| Missing rule | silently 18% (or 0 on null result) | blocked: `No applicable tax configuration found …` |
| Existing tax rules | free-text names | kept; auto-linked when the name matches an active category |
| S3 responses in S6 | fields read as null (envelope) | unwrapped correctly |
| Multi-retailer order/payment split | – | unchanged |
| Historical orders | – | not recalculated |

---

## 11. Testing

### Test Case 1 — New category reaches the Retailer
1. As Admin create a product category (ACTIVE).
2. As Retailer open My Catalogue → Add product (no page refresh needed).
3. Expected: the new category is in the Category dropdown.

### Test Case 2 — Inactive category
1. Set the category INACTIVE and reopen Add product.
2. Expected: it is not offered. A direct API create with that category id is rejected with `Category '…' is not active - choose an active category`.

### Test Case 3 — Existing product with an inactive category
1. Edit a product whose category was switched off.
2. Expected: the form shows `Current category (no longer active)`; saving without changing the category works; choosing another active category works.

### Test Case 4 — Tax rule for a category
1. Admin → Finance → Tax configurations → New tax rule.
2. Pick a category, CGST 2.5, SGST 2.5, optional state; Create.
3. Expected: the rule appears in the table with the category name.

### Test Case 5 — Invalid category for a rule
1. Create a rule for an INACTIVE or non-existent category id via the API.
2. Expected: `Product category is not active` / `Product category not found`.

### Test Case 6 — Overlap
1. Create a second active rule for the same category and state in the same date range.
2. Expected: `An active tax configuration already exists for this category and state in the same effective period`.

### Test Case 7 — Checkout, single and mixed baskets
1. Customer with an address in a state that has rules for Groceries (5%) and Electronics (18%) adds products of both categories.
2. Proceed to checkout.
3. Expected: tax = 5% on the grocery lines + 18% on the electronics lines; the tax shown in the summary is stored on the order.

### Test Case 8 — Missing configuration
1. Add a product whose category has no rule for the customer's state.
2. Expected: checkout is blocked with `No applicable tax configuration found for product category <name>`; no default rate is applied.

### Test Case 9 — Legacy rules
1. With a legacy rule named exactly like an active category (e.g. `Groceries`) and no category id.
2. Open the tax list or start checkout.
3. Expected: the rule is linked to the category id; a rule matching nothing shows `No category linked` and never applies.

### Test Case 10 — Multi-retailer cart
1. Buy from two retailers in one checkout.
2. Expected: tax is calculated per retailer group as before; order and payment splitting are unchanged.

### Automated
`TaxCalculationServiceTest` (mixed categories, state vs nationwide, missing rule, on-demand linking, unknown state, missing category), `TaxConfigurationServiceImplTest` (active/inactive/missing category, overlap), `CheckoutServiceComprehensiveTest` (category sent, null tax blocks, S6 409 message). S3 (119), S4 (149) and S1 pass; S6's unit tests pass (its `@SpringBootTest` context test needs the remote database and cannot run offline).

---

## 12. Final Result

```text
After the fix:

- Retailers see the current ACTIVE categories every time they add or edit a product.
- Only ACTIVE categories can be assigned to a product or a tax rule (enforced in the backend).
- A tax rule belongs to a product category by id (no cross-service JPA relation, no duplicate table).
- Checkout taxes each category with its own rule for the customer's state and active dates.
- A missing rule blocks checkout with a clear message; there is no default rate.
- Old rules are preserved and auto-linked; historical orders and multi-retailer splitting are untouched.
```
