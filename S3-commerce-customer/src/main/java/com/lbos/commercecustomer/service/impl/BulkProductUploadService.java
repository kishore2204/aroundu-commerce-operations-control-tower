package com.lbos.commercecustomer.service.impl;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import com.lbos.commercecustomer.dto.request.ProductRequest;
import com.lbos.commercecustomer.dto.response.BulkProductUploadResponse;
import com.lbos.commercecustomer.dto.response.BulkProductUploadResponse.Conflict;
import com.lbos.commercecustomer.dto.response.BulkProductUploadResponse.FieldChange;
import com.lbos.commercecustomer.dto.response.BulkProductUploadResponse.RejectedRow;
import com.lbos.commercecustomer.entity.Product;
import com.lbos.commercecustomer.entity.ProductCategory;
import com.lbos.commercecustomer.enums.CategoryStatus;
import com.lbos.commercecustomer.enums.ProductStatus;
import com.lbos.commercecustomer.exception.BusinessValidationException;
import com.lbos.commercecustomer.repository.ProductCategoryRepository;
import com.lbos.commercecustomer.repository.ProductRepository;
import com.lbos.commercecustomer.service.impl.SpreadsheetSupport.SheetRow;
import com.lbos.commercecustomer.service.impl.SpreadsheetSupport.UnreadableSpreadsheetException;
import com.lbos.commercecustomer.service.impl.SpreadsheetSupport.WriteCell;
import com.lbos.commercecustomer.service.impl.SpreadsheetSupport.WriteSheet;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;

/**
 * Retailer bulk product upload (.xlsx / .csv, up to {@value #MAX_ROWS} rows) - a batch-entry layer
 * over the existing product system, not a second implementation of it:
 * <ul>
 *   <li>every row is validated with the constraints already declared on {@link ProductRequest};</li>
 *   <li>new and updated products are populated through {@link CatalogueServiceImpl#copyFields},
 *       the same assignment the single-product create/update uses;</li>
 *   <li>stock changes go through the existing atomic {@code addStock}/{@code removeStock} updates;</li>
 *   <li>the retailer is resolved once (ContextSupport) and only ever sees/changes their own
 *       products - the SKU lookup is scoped to that retailer;</li>
 *   <li>categories and existing products are each loaded with one query, not once per row.</li>
 * </ul>
 * A SKU that already exists is never silently overwritten: if the uploaded data differs, the call
 * returns NEEDS_DECISIONS (nothing written) and the retailer chooses UPDATE / KEEP / SKIP per SKU;
 * the same file is then sent again together with those decisions. Valid rows are applied even if
 * other rows are rejected.
 */
@Service
public class BulkProductUploadService {

    static final int MAX_ROWS = 500;
    private static final String DECISION_UPDATE = "UPDATE";
    private static final String DECISION_KEEP = "KEEP";
    private static final String DECISION_SKIP = "SKIP";

    /** The upload columns - one place that drives the parser, the template and the rejected report. */
    private enum Column {
        SKU("SKU", true, "sku"),
        NAME("Name", true, "name", "productname"),
        CATEGORY("Category", true, "category", "categoryname"),
        DESCRIPTION("Description", true, "description"),
        PRICE("Unit Price", true, "unitprice", "price"),
        STOCK("Stock", true, "stock", "stockquantity", "initialstock"),
        WEIGHT("Weight (kg)", false, "weightkg", "weight"),
        STATUS("Status", true, "status"),
        LOW_STOCK("Low Stock Threshold", false, "lowstockthreshold", "lowstock");

        final String label;
        final boolean required;
        final Set<String> aliases;

        Column(String label, boolean required, String... aliases) {
            this.label = label;
            this.required = required;
            this.aliases = Set.of(aliases);
        }
    }

    /**
     * What the upload enforces per field, READ FROM {@link ProductRequest}'s own constraints (the ones every row is validated
     * with), so the text in the downloadable template cannot drift from the real validation.
     */
    private static final class Limits {
        static final int NAME_MIN = size("name").min();
        static final int NAME_MAX = size("name").max();
        static final int DESCRIPTION_MIN = size("description").min();
        static final int DESCRIPTION_MAX = size("description").max();
        static final int SKU_MIN = skuLength(0);
        static final int SKU_MAX = skuLength(1);
        static final String PRICE_MIN = decimalMin("unitPrice");
        static final int PRICE_DECIMALS = digits("unitPrice").fraction();
        static final int STOCK_MIN = (int) min("stock");
        static final int LOW_STOCK_MIN = (int) min("lowStockThreshold");
        static final String WEIGHT_MIN = decimalMin("weightKg");
        static final int WEIGHT_DECIMALS = digits("weightKg").fraction();

        private static <A extends java.lang.annotation.Annotation> A constraint(String accessor, Class<A> type) {
            try {
                A found = ProductRequest.class.getMethod(accessor).getAnnotation(type);
                if (found == null) {
                    throw new IllegalStateException("ProductRequest." + accessor + " has no @" + type.getSimpleName());
                }
                return found;
            } catch (NoSuchMethodException missing) {
                throw new IllegalStateException("ProductRequest has no field " + accessor, missing);
            }
        }

        private static jakarta.validation.constraints.Size size(String accessor) {
            return constraint(accessor, jakarta.validation.constraints.Size.class);
        }

        private static jakarta.validation.constraints.Digits digits(String accessor) {
            return constraint(accessor, jakarta.validation.constraints.Digits.class);
        }

        private static String decimalMin(String accessor) {
            return constraint(accessor, jakarta.validation.constraints.DecimalMin.class).value();
        }

        private static long min(String accessor) {
            return constraint(accessor, jakarta.validation.constraints.Min.class).value();
        }

        /** The SKU rule is a regex like {@code [A-Za-z0-9_-]{3,20}}: its length bounds are the ones shown. */
        private static int skuLength(int group) {
            java.util.regex.Matcher bounds = java.util.regex.Pattern.compile("\\{(\\d+),(\\d+)}")
                    .matcher(constraint("sku", jakarta.validation.constraints.Pattern.class).regexp());
            if (!bounds.find()) {
                throw new IllegalStateException("The SKU pattern has no {min,max} length");
            }
            return Integer.parseInt(bounds.group(group + 1));
        }
    }

    /**
     * The header text for one template column - the field guidance lives here (never in a separate sheet or file), so it
     * travels with the template itself and can never drift from what {@link ProductRequest} actually enforces.
     * Category and Status stay plain in the XLSX header because the cells themselves offer a dropdown; a CSV cannot hold
     * a dropdown, so its Category/Status headers carry the equivalent guidance in words instead.
     */
    private static String headerText(Column column, List<String> statuses, boolean forCsv) {
        return switch (column) {
            case SKU -> "SKU (Unique code, " + Limits.SKU_MIN + "-" + Limits.SKU_MAX + " letters, digits, '-' or '_')";
            case NAME -> "Name";
            case CATEGORY -> forCsv ? "Category (Active category name)" : "Category";
            case DESCRIPTION -> "Description (" + Limits.DESCRIPTION_MIN + "-" + Limits.DESCRIPTION_MAX + " characters)";
            case PRICE -> "Unit Price";
            case STOCK -> "Stock";
            case WEIGHT -> "Weight (kg) (default 1 kg if not specified)";
            case STATUS -> forCsv ? "Status (Choose valid status: " + humanList(statuses) + ")" : "Status";
            case LOW_STOCK -> "Low Stock Threshold (Optional)";
        };
    }

    /** {@code ["ACTIVE"] -> "ACTIVE"}, {@code ["ACTIVE","DRAFT"] -> "ACTIVE or DRAFT"}, three or more join with commas and a final "or". */
    private static String humanList(List<String> items) {
        if (items.size() <= 1) {
            return items.isEmpty() ? "" : items.get(0);
        }
        if (items.size() == 2) {
            return items.get(0) + " or " + items.get(1);
        }
        return String.join(", ", items.subList(0, items.size() - 1)) + ", or " + items.get(items.size() - 1);
    }

    private List<String> activeCategoryNames() {
        return categories.findAll().stream().filter(category -> category.getStatus() == CategoryStatus.ACTIVE)
                .map(ProductCategory::getName).sorted(String.CASE_INSENSITIVE_ORDER).toList();
    }

    /** A row that passed validation, ready to be created or compared with the existing product. */
    private record Candidate(SheetRow row, Map<String, String> original, String sku, ProductRequest request,
            ProductCategory category) {
    }

    private record Change(Conflict conflict, Product existing, Candidate candidate) {
    }

    private final ProductRepository products;
    private final ProductCategoryRepository categories;
    private final ContextSupport ctx;
    private final Validator validator;
    private final TransactionTemplate tx;

    public BulkProductUploadService(ProductRepository products, ProductCategoryRepository categories,
            ContextSupport ctx, Validator validator, PlatformTransactionManager transactionManager) {
        this.products = products;
        this.categories = categories;
        this.ctx = ctx;
        this.validator = validator;
        this.tx = new TransactionTemplate(transactionManager);
    }

    // --------------------------------------------------------------------------------- upload

    /**
     * @param decisions upper-cased SKU -> UPDATE / KEEP / SKIP for SKUs that already exist with
     *                  different data; may be empty on the first call
     */
    public BulkProductUploadResponse upload(MultipartFile file, Map<String, String> decisions) {
        List<SheetRow> rows = parse(file);
        Map<Column, Integer> columns = mapColumns(rows.get(0));
        List<SheetRow> dataRows = rows.subList(1, rows.size());
        // The retailer is resolved once (one call to S2), before any transaction is opened.
        UUID retailerId = ctx.retailer().retailerId();
        return tx.execute(status -> process(retailerId, columns, dataRows, decisions == null ? Map.of() : decisions));
    }

    private BulkProductUploadResponse process(UUID retailerId, Map<Column, Integer> columns, List<SheetRow> dataRows,
            Map<String, String> decisions) {
        Map<String, ProductCategory> categoriesByName = new HashMap<>();
        for (ProductCategory category : categories.findAll()) {
            categoriesByName.put(category.getName().trim().toLowerCase(Locale.ROOT), category);
        }

        List<RejectedRow> rejected = new ArrayList<>();
        List<Candidate> candidates = new ArrayList<>();
        Map<String, Integer> firstRowOfSku = new HashMap<>();
        for (SheetRow row : dataRows) {
            Map<String, String> original = originalValues(row, columns);
            RowResult result = validate(row, original, columns, categoriesByName);
            if (result.error != null) {
                rejected.add(new RejectedRow(row.number(), original, result.error, result.errorFields));
                continue;
            }
            Candidate candidate = result.candidate;
            Integer earlier = firstRowOfSku.putIfAbsent(candidate.sku, row.number());
            if (earlier != null) {
                rejected.add(new RejectedRow(row.number(), original,
                        "SKU '" + candidate.sku + "' appears more than once in the file (first on row " + earlier + ").",
                        List.of(Column.SKU.label)));
                continue;
            }
            candidates.add(candidate);
        }

        Map<String, Product> existingBySku = new HashMap<>();
        if (!candidates.isEmpty()) {
            for (Product product : products.findWithCategoryByRetailerIdAndSkuIn(retailerId,
                    candidates.stream().map(candidate -> candidate.sku).toList())) {
                existingBySku.put(product.getSku().trim().toUpperCase(Locale.ROOT), product);
            }
        }

        List<Candidate> toCreate = new ArrayList<>();
        List<Change> changes = new ArrayList<>();
        int unchanged = 0;
        for (Candidate candidate : candidates) {
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
        }

        boolean undecided = changes.stream().anyMatch(change -> decisionFor(decisions, change.conflict.sku()) == null);
        if (undecided) {
            return new BulkProductUploadResponse("NEEDS_DECISIONS", dataRows.size(),
                    changes.stream().map(Change::conflict).toList(), 0, 0, 0, 0, List.of());
        }

        // ---- everything is decided: write ----
        List<Product> newProducts = new ArrayList<>();
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

        rejected.sort(Comparator.comparingInt(RejectedRow::rowNumber));
        return new BulkProductUploadResponse("COMPLETED", dataRows.size(), List.of(), newProducts.size(), updated,
                unchanged, rejected.size(), rejected);
    }

    private static String decisionFor(Map<String, String> decisions, String sku) {
        String decision = decisions.get(sku);
        if (decision == null) {
            return null;
        }
        String normalized = decision.trim().toUpperCase(Locale.ROOT);
        return Set.of(DECISION_UPDATE, DECISION_KEEP, DECISION_SKIP).contains(normalized) ? normalized : null;
    }

    /** Updates every field the uploaded row supplies; stock via the existing atomic stock updates. */
    private void updateExisting(UUID retailerId, Change change) {
        Product existing = change.existing;
        ProductRequest uploaded = change.candidate.request;
        // A blank optional cell means "not supplied": keep the current low-stock threshold.
        Integer lowStock = uploaded.lowStockThreshold() != null ? uploaded.lowStockThreshold() : existing.getLowStockThreshold();
        // A blank weight cell means "not supplied": keep the product's current (effective) weight.
        java.math.BigDecimal weight = uploaded.weightKg() != null ? uploaded.weightKg() : existing.effectiveWeightKg();
        ProductRequest effective = new ProductRequest(uploaded.name(), uploaded.sku(), uploaded.categoryId(),
                uploaded.unitPrice(), uploaded.stock(), uploaded.status(), uploaded.description(), lowStock, weight);
        int stockDelta = uploaded.stock() - existing.getStock();

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
    }

    private List<FieldChange> differences(Product existing, Candidate candidate) {
        ProductRequest uploaded = candidate.request;
        List<FieldChange> changes = new ArrayList<>();
        if (!existing.getName().trim().equals(uploaded.name().trim())) {
            changes.add(new FieldChange("Product Name", existing.getName(), uploaded.name().trim()));
        }
        if (!existing.getCategory().getId().equals(candidate.category.getId())) {
            changes.add(new FieldChange("Category", existing.getCategory().getName(), candidate.category.getName()));
        }
        if (existing.getUnitPrice().compareTo(uploaded.unitPrice()) != 0) {
            changes.add(new FieldChange("Price", existing.getUnitPrice().setScale(2, java.math.RoundingMode.HALF_UP).toPlainString(),
                    uploaded.unitPrice().setScale(2, java.math.RoundingMode.HALF_UP).toPlainString()));
        }
        if (existing.getStock() != uploaded.stock()) {
            changes.add(new FieldChange("Stock", String.valueOf(existing.getStock()), String.valueOf(uploaded.stock())));
        }
        if (uploaded.weightKg() != null && existing.effectiveWeightKg().compareTo(uploaded.weightKg()) != 0) {
            changes.add(new FieldChange("Weight (kg)", existing.effectiveWeightKg().stripTrailingZeros().toPlainString(),
                    uploaded.weightKg().stripTrailingZeros().toPlainString()));
        }
        if (existing.getStatus() != uploaded.status()) {
            changes.add(new FieldChange("Status", existing.getStatus().name(), uploaded.status().name()));
        }
        if (!Objects.equals(existing.getDescription() == null ? null : existing.getDescription().trim(), uploaded.description().trim())) {
            changes.add(new FieldChange("Description", existing.getDescription(), uploaded.description().trim()));
        }
        if (uploaded.lowStockThreshold() != null && !Objects.equals(existing.getLowStockThreshold(), uploaded.lowStockThreshold())) {
            changes.add(new FieldChange("Low Stock Threshold",
                    existing.getLowStockThreshold() == null ? "-" : String.valueOf(existing.getLowStockThreshold()),
                    String.valueOf(uploaded.lowStockThreshold())));
        }
        return changes;
    }

    // ------------------------------------------------------------------------------ validation

    private static final class RowResult {
        String error;
        List<String> errorFields = List.of();
        Candidate candidate;
    }

    private RowResult validate(SheetRow row, Map<String, String> original, Map<Column, Integer> columns,
            Map<String, ProductCategory> categoriesByName) {
        Map<Column, String> cell = new EnumMap<>(Column.class);
        for (Column column : Column.values()) {
            cell.put(column, original.getOrDefault(column.label, ""));
        }
        Map<Column, String> errors = new EnumMap<>(Column.class);

        ProductCategory category = null;
        String categoryName = cell.get(Column.CATEGORY);
        if (!categoryName.isEmpty()) {
            category = categoriesByName.get(categoryName.toLowerCase(Locale.ROOT));
            if (category == null) {
                errors.put(Column.CATEGORY, "Category '" + categoryName + "' does not exist.");
            }
        }

        BigDecimal price = null;
        if (!cell.get(Column.PRICE).isEmpty()) {
            price = decimal(cell.get(Column.PRICE));
            if (price == null) {
                errors.put(Column.PRICE, "Price must be a number.");
            }
        }
        Integer stock = null;
        if (!cell.get(Column.STOCK).isEmpty()) {
            stock = wholeNumber(cell.get(Column.STOCK));
            if (stock == null) {
                errors.put(Column.STOCK, "Stock must be a whole number.");
            }
        }
        Integer lowStock = null;
        if (!cell.get(Column.LOW_STOCK).isEmpty()) {
            lowStock = wholeNumber(cell.get(Column.LOW_STOCK));
            if (lowStock == null) {
                errors.put(Column.LOW_STOCK, "Low Stock Threshold must be a whole number.");
            }
        }
        // Weight is optional: blank -> null -> 1 kg. Anything else must be a positive number.
        BigDecimal weight = null;
        if (!cell.get(Column.WEIGHT).isEmpty()) {
            weight = decimal(cell.get(Column.WEIGHT));
            if (weight == null) {
                errors.put(Column.WEIGHT, "Weight must be a number (in kg).");
            }
        }
        ProductStatus status = null;
        if (!cell.get(Column.STATUS).isEmpty()) {
            try {
                status = ProductStatus.valueOf(cell.get(Column.STATUS).toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException invalid) {
                errors.put(Column.STATUS, "Invalid status '" + cell.get(Column.STATUS) + "'. Allowed values: "
                        + String.join(", ", Arrays.stream(ProductStatus.values()).map(Enum::name).toList()) + ".");
            }
        }

        // The existing ProductRequest constraints decide everything else (required, lengths, ranges, SKU format).
        ProductRequest request = new ProductRequest(cell.get(Column.NAME), cell.get(Column.SKU),
                category == null ? -1L : category.getId(), price, stock, status,
                cell.get(Column.DESCRIPTION), lowStock, weight);
        for (ConstraintViolation<ProductRequest> violation : validator.validate(request)) {
            Column column = columnFor(violation.getPropertyPath().toString());
            if (column == null || errors.containsKey(column)) {
                continue;
            }
            // A field that failed to parse above (or an unresolved category) is already explained.
            boolean alreadyExplained = (column == Column.PRICE && price == null && !cell.get(Column.PRICE).isEmpty())
                    || (column == Column.STOCK && stock == null && !cell.get(Column.STOCK).isEmpty())
                    || (column == Column.LOW_STOCK && lowStock == null && !cell.get(Column.LOW_STOCK).isEmpty())
                    || (column == Column.WEIGHT && weight == null && !cell.get(Column.WEIGHT).isEmpty())
                    || (column == Column.STATUS && status == null && !cell.get(Column.STATUS).isEmpty());
            if (!alreadyExplained) {
                errors.put(column, friendlyMessage(column, violation));
            }
        }
        if (cell.get(Column.CATEGORY).isEmpty()) {
            errors.putIfAbsent(Column.CATEGORY, "Category is required.");
        }
        if (stock == null && cell.get(Column.STOCK).isEmpty()) {
            errors.putIfAbsent(Column.STOCK, "Stock is required.");
        }

        RowResult result = new RowResult();
        if (!errors.isEmpty()) {
            result.error = String.join(" ", errors.values());
            result.errorFields = errors.keySet().stream().map(column -> column.label).toList();
            return result;
        }
        String sku = request.sku().trim().toUpperCase(Locale.ROOT);
        ProductRequest normalized = new ProductRequest(request.name().trim(), sku, category.getId(), price, stock, status,
                request.description().trim(), lowStock, weight);
        result.candidate = new Candidate(row, original, sku, normalized, category);
        return result;
    }

    private static Column columnFor(String property) {
        return switch (property) {
            case "name" -> Column.NAME;
            case "sku" -> Column.SKU;
            case "categoryId" -> Column.CATEGORY;
            case "unitPrice" -> Column.PRICE;
            case "stock" -> Column.STOCK;
            case "status" -> Column.STATUS;
            case "description" -> Column.DESCRIPTION;
            case "lowStockThreshold" -> Column.LOW_STOCK;
            case "weightKg" -> Column.WEIGHT;
            default -> null;
        };
    }

    private static String friendlyMessage(Column column, ConstraintViolation<ProductRequest> violation) {
        String kind = violation.getConstraintDescriptor().getAnnotation().annotationType().getSimpleName();
        return switch (kind) {
            case "NotBlank", "NotNull" -> column.label + " is required.";
            case "DecimalMin" -> column == Column.WEIGHT ? "Weight must be greater than 0 kg." : "Price must be greater than 0.";
            case "Digits" -> column == Column.WEIGHT ? "Weight can have at most 3 decimal places." : "Price can have at most 2 decimal places.";
            case "Min" -> column == Column.STOCK ? "Stock cannot be negative." : column.label + " cannot be negative.";
            case "Pattern" -> "SKU must be 3-20 characters: letters, digits, '-' or '_'.";
            case "Size" -> switch (column) {
                case NAME -> "Name must be between 3 and 80 characters.";
                case DESCRIPTION -> "Description must be between 10 and 300 characters.";
                default -> column.label + " has an invalid length.";
            };
            default -> column.label + " " + violation.getMessage() + ".";
        };
    }

    private static BigDecimal decimal(String text) {
        try {
            return new BigDecimal(text.replace(",", "").trim());
        } catch (NumberFormatException invalid) {
            return null;
        }
    }

    private static Integer wholeNumber(String text) {
        BigDecimal value = decimal(text);
        if (value == null) {
            return null;
        }
        try {
            return value.stripTrailingZeros().scale() <= 0 ? value.intValueExact() : null;
        } catch (ArithmeticException tooLarge) {
            return null;
        }
    }

    // ---------------------------------------------------------------------------------- parsing

    private List<SheetRow> parse(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessValidationException("The file is empty. Choose a .xlsx or .csv file with your products.");
        }
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        boolean xlsx = name.endsWith(".xlsx");
        if (!xlsx && !name.endsWith(".csv")) {
            throw new BusinessValidationException("Unsupported file type. Upload an .xlsx or .csv file.");
        }
        byte[] data;
        try {
            data = file.getBytes();
        } catch (IOException unreadable) {
            throw new BusinessValidationException("The file could not be read. Please try again.");
        }
        List<SheetRow> rows;
        if (xlsx) {
            if (!SpreadsheetSupport.looksLikeXlsx(data)) {
                throw new BusinessValidationException("The file is not a valid Excel (.xlsx) workbook.");
            }
            try {
                rows = SpreadsheetSupport.readXlsx(data, MAX_ROWS + 2);
            } catch (UnreadableSpreadsheetException unreadable) {
                throw new BusinessValidationException(unreadable.getMessage());
            }
        } else {
            rows = SpreadsheetSupport.readCsv(data, MAX_ROWS + 2);
        }
        if (rows.size() < 2) {
            throw new BusinessValidationException("The file has no product rows. Add a header row and at least one product.");
        }
        if (rows.size() - 1 > MAX_ROWS) {
            throw new BusinessValidationException("The file has more than " + MAX_ROWS
                    + " product rows. Split it into smaller files (maximum " + MAX_ROWS + " rows per upload).");
        }
        return rows;
    }

    private Map<Column, Integer> mapColumns(SheetRow header) {
        Map<Column, Integer> columns = new EnumMap<>(Column.class);
        for (int i = 0; i < header.cells().size(); i++) {
            // A template header now carries its guidance in parentheses, e.g. "SKU (Unique code, 3-20 ...)" - only the
            // text before the first '(' is the column name itself.
            String raw = header.cells().get(i);
            int guidance = raw.indexOf('(');
            String name = guidance >= 0 ? raw.substring(0, guidance) : raw;
            String key = name.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
            for (Column column : Column.values()) {
                if (column.aliases.contains(key) && !columns.containsKey(column)) {
                    columns.put(column, i);
                }
            }
        }
        List<String> missing = Arrays.stream(Column.values())
                .filter(column -> column.required && !columns.containsKey(column)).map(column -> column.label).toList();
        if (!missing.isEmpty()) {
            throw new BusinessValidationException("The file is missing required column(s): " + String.join(", ", missing)
                    + ". Download the template to see the expected columns.");
        }
        return columns;
    }

    private static Map<String, String> originalValues(SheetRow row, Map<Column, Integer> columns) {
        Map<String, String> values = new LinkedHashMap<>();
        for (Column column : Column.values()) {
            Integer index = columns.get(column);
            String text = index == null || index >= row.cells().size() ? "" : row.cells().get(index).trim();
            values.put(column.label, text);
        }
        return values;
    }

    // ------------------------------------------------------------------- template and report files

    /** Blank rows left under the header so the sheet is immediately ready to type into. */
    private static final int BLANK_ROWS = 20;

    /**
     * The upload template, built from CURRENT data every time it is downloaded - nothing here is a stored file, and there
     * is no separate guide file of any kind: every field's guidance is embedded directly in its header cell text.
     * <ul>
     *   <li>{@code xlsx} (default): a single "Products" sheet. The header row carries the field guidance
     *       (see {@link #headerText}); Category and Status get a real Excel dropdown across the whole entry range
     *       ({@code 2..MAX_ROWS+1}) - Category from the categories that are active right now, Status from
     *       {@link ProductStatus}. The dropdown values live on a hidden "Lists" sheet, referenced by workbook-level
     *       named ranges, purely as Excel's internal plumbing for the two dropdowns.</li>
     *   <li>{@code csv}: the header row only, in the current column order, with the same guidance embedded in the header
     *       text - a CSV cannot hold a real dropdown, so its Category/Status headers spell out the current allowed
     *       values in words instead.</li>
     * </ul>
     */
    public byte[] template(String format) {
        List<String> statuses = Arrays.stream(ProductStatus.values()).map(Enum::name).toList();

        if ("csv".equalsIgnoreCase(format)) {
            List<String> header = Arrays.stream(Column.values()).map(column -> headerText(column, statuses, true)).toList();
            return toCsv(List.of(header));
        }

        List<String> categoryNames = activeCategoryNames();

        // ---- Products: header row (guidance embedded) + blank entry rows
        List<List<WriteCell>> productSheet = new ArrayList<>();
        productSheet.add(Arrays.stream(Column.values())
                .map(column -> new WriteCell(headerText(column, statuses, false), SpreadsheetSupport.STYLE_HEADER)).toList());
        for (int row = 0; row < BLANK_ROWS; row++) {
            productSheet.add(List.of());
        }

        List<SpreadsheetSupport.DataValidation> validations = List.of(
                new SpreadsheetSupport.DataValidation(dataRange(Column.CATEGORY), CATEGORY_LIST_NAME, "Category",
                        "Choose an active category from the list.", "Not in the list",
                        "Choose one of the active categories from the list."),
                new SpreadsheetSupport.DataValidation(dataRange(Column.STATUS), STATUS_LIST_NAME, "Status",
                        "Choose a status: " + humanList(statuses) + ".", "Not in the list",
                        "Choose one of the listed status values."));

        // ---- Lists (hidden): the values behind the two dropdowns, in columns A (category) and B (status)
        List<List<WriteCell>> lists = new ArrayList<>();
        lists.add(headerRow("Category", "Status"));
        for (int row = 0; row < Math.max(categoryNames.size(), statuses.size()); row++) {
            lists.add(List.of(new WriteCell(row < categoryNames.size() ? categoryNames.get(row) : "", 0),
                    new WriteCell(row < statuses.size() ? statuses.get(row) : "", 0)));
        }
        Map<String, String> names = new LinkedHashMap<>();
        names.put(CATEGORY_LIST_NAME, "Lists!$A$2:$A$" + Math.max(2, categoryNames.size() + 1));
        names.put(STATUS_LIST_NAME, "Lists!$B$2:$B$" + Math.max(2, statuses.size() + 1));

        return SpreadsheetSupport.writeXlsx(List.of(
                new WriteSheet("Products", List.of(34, 16, 20, 32, 14, 10, 34, 14, 26), productSheet, false, true, validations),
                new WriteSheet("Lists", List.of(30, 16), lists, true, false, List.of())), names);
    }

    private static String dataRange(Column column) {
        String letter = SpreadsheetSupport.columnName(column.ordinal());
        return letter + "2:" + letter + (MAX_ROWS + 1);
    }

    private static final String CATEGORY_LIST_NAME = "CategoryList";
    private static final String STATUS_LIST_NAME = "StatusList";

    private static List<WriteCell> headerRow(String... labels) {
        return Arrays.stream(labels).map(label -> new WriteCell(label, SpreadsheetSupport.STYLE_HEADER)).toList();
    }

    /** UTF-8 CSV with a byte-order mark (so Excel reads it correctly) and CRLF line ends; every value is escaped by {@link #csvField}. */
    private static byte[] toCsv(List<List<String>> lines) {
        StringBuilder csv = new StringBuilder("﻿");
        for (List<String> line : lines) {
            csv.append(String.join(",", line.stream().map(BulkProductUploadService::csvField).toList())).append("\r\n");
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    /**
     * The rejected-products report as ONE table - a header row (every upload column, then Error) and one row per
     * rejected product with the original values and the exact reason. The XLSX and the CSV download are both written
     * from this table (and the "Rejection Log" on screen shows the same rows), so they can never differ.
     */
    private static List<List<String>> rejectedTable(List<RejectedRow> rows) {
        if (rows == null || rows.isEmpty()) {
            throw new BusinessValidationException("There are no rejected products to download.");
        }
        List<List<String>> table = new ArrayList<>();
        List<String> header = new ArrayList<>();
        for (Column column : Column.values()) {
            header.add(column.label);
        }
        header.add("Error");
        table.add(header);
        for (RejectedRow row : rows) {
            List<String> cells = new ArrayList<>();
            for (Column column : Column.values()) {
                cells.add(row.values() == null ? "" : row.values().getOrDefault(column.label, ""));
            }
            cells.add(row.error() == null ? "" : row.error());
            table.add(cells);
        }
        return table;
    }

    /** The rejected rows with every original value plus an Error column; failing cells are red. */
    public byte[] rejectedReport(List<RejectedRow> rows) {
        List<List<String>> table = rejectedTable(rows);
        List<List<WriteCell>> sheet = new ArrayList<>();
        sheet.add(table.get(0).stream().map(label -> new WriteCell(label, SpreadsheetSupport.STYLE_HEADER)).toList());
        for (int index = 0; index < rows.size(); index++) {
            RejectedRow row = rows.get(index);
            List<String> values = table.get(index + 1);
            Set<String> highlighted = row.errorFields() == null ? Set.of() : new HashSet<>(row.errorFields());
            List<WriteCell> cells = new ArrayList<>();
            Column[] columns = Column.values();
            for (int column = 0; column < columns.length; column++) {
                cells.add(new WriteCell(values.get(column), highlighted.contains(columns[column].label)
                        ? SpreadsheetSupport.STYLE_ERROR_CELL : SpreadsheetSupport.STYLE_NORMAL));
            }
            cells.add(new WriteCell(values.get(columns.length), SpreadsheetSupport.STYLE_ERROR_TEXT));
            sheet.add(cells);
        }
        return SpreadsheetSupport.writeXlsx(List.of(
                new WriteSheet("Rejected Products", List.of(16, 28, 22, 44, 14, 10, 12, 12, 20, 70), sheet)));
    }

    /**
     * The same rejected table as UTF-8 CSV: a value containing a comma, a quote or a line break is quoted (a quote inside
     * becomes two), nothing is trimmed or altered, and a byte-order mark lets Excel open the file with the right encoding.
     */
    public byte[] rejectedReportCsv(List<RejectedRow> rows) {
        return toCsv(rejectedTable(rows));
    }

    private static String csvField(String value) {
        String text = value == null ? "" : value;
        boolean needsQuotes = text.indexOf(',') >= 0 || text.indexOf('"') >= 0 || text.indexOf('\n') >= 0 || text.indexOf('\r') >= 0;
        if (!needsQuotes) {
            return text;
        }
        return '"' + text.replace(String.valueOf('"'), String.valueOf('"') + '"') + '"';
    }
}
