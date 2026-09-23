package com.lbos.commercecustomer.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;

import com.lbos.commercecustomer.dto.client.partner.RetailerContextResponse;
import com.lbos.commercecustomer.dto.response.BulkProductUploadResponse;
import com.lbos.commercecustomer.entity.Product;
import com.lbos.commercecustomer.entity.ProductCategory;
import com.lbos.commercecustomer.enums.ProductStatus;
import com.lbos.commercecustomer.exception.BusinessValidationException;
import com.lbos.commercecustomer.repository.ProductCategoryRepository;
import com.lbos.commercecustomer.repository.ProductRepository;
import com.lbos.commercecustomer.service.impl.BulkProductUploadService;
import com.lbos.commercecustomer.service.impl.ContextSupport;

import jakarta.validation.Validation;

@ExtendWith(MockitoExtension.class)
class BulkProductUploadServiceTest {

    private static final String HEADER = "SKU,Name,Category,Description,Unit Price,Stock,Status,Low Stock Threshold\n";

    @Mock private ProductRepository products;
    @Mock private ProductCategoryRepository categories;
    @Mock private ContextSupport ctx;
    @Mock private PlatformTransactionManager transactionManager;

    private BulkProductUploadService service;
    private final UUID retailerId = UUID.randomUUID();
    private ProductCategory groceries;
    private ProductCategory fruits;

    @BeforeEach
    void setUp() {
        service = new BulkProductUploadService(products, categories, ctx,
                Validation.buildDefaultValidatorFactory().getValidator(), transactionManager);
        lenient().when(ctx.retailer()).thenReturn(new RetailerContextResponse(retailerId, UUID.randomUUID(), "Shop", UUID.randomUUID()));
        groceries = category(1L, "Groceries");
        fruits = category(2L, "Fruits");
        lenient().when(categories.findAll()).thenReturn(List.of(groceries, fruits));
        lenient().when(products.findWithCategoryByRetailerIdAndSkuIn(any(), any())).thenReturn(List.of());
    }

    private static ProductCategory category(long id, String name) {
        ProductCategory category = new ProductCategory();
        category.setId(id);
        category.setName(name);
        return category;
    }

    private Product existing(String sku, String name, ProductCategory category, String price, int stock) {
        Product product = new Product();
        product.setId(99L);
        product.setRetailerId(retailerId);
        product.setSku(sku);
        product.setName(name);
        product.setCategory(category);
        product.setUnitPrice(new BigDecimal(price));
        product.setStock(stock);
        product.setStatus(ProductStatus.ACTIVE);
        product.setDescription("Fresh red apples, 1kg");
        return product;
    }

    private static MockMultipartFile csv(String rows) {
        return new MockMultipartFile("file", "products.csv", "text/csv", (HEADER + rows).getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void createsValidRowsAndRejectsInvalidOnesWithAnExactReasonPerRow() {
        var response = service.upload(csv(
                "APPLE-1,Apple,Groceries,Fresh red apples 1kg,100,20,ACTIVE,5\n"
                        + "BAD-CAT,Mango,Nowhere,Sweet ripe mangoes,50,10,ACTIVE,\n"
                        + "BAD-PRICE,Pear,Fruits,Juicy green pears,0,10,ACTIVE,\n"
                        + "BAD-STOCK,Plum,Fruits,Small purple plums,10,-3,ACTIVE,\n"
                        + "BAD-STATUS,Kiwi,Fruits,Green fuzzy kiwis,10,3,LIVE,\n"), Map.of());

        assertEquals("COMPLETED", response.status());
        assertEquals(1, response.created());
        assertEquals(4, response.rejected());
        Map<String, String> errors = new java.util.HashMap<>();
        response.rejectedRows().forEach(row -> errors.put(row.values().get("SKU"), row.error()));
        assertEquals("Category 'Nowhere' does not exist.", errors.get("BAD-CAT"));
        assertEquals("Price must be greater than 0.", errors.get("BAD-PRICE"));
        assertEquals("Stock cannot be negative.", errors.get("BAD-STOCK"));
        assertTrue(errors.get("BAD-STATUS").startsWith("Invalid status 'LIVE'. Allowed values: ACTIVE, DRAFT"));
        // original values are kept for the report, and the failing cell is named for highlighting
        var badCategory = response.rejectedRows().stream().filter(r -> "BAD-CAT".equals(r.values().get("SKU"))).findFirst().orElseThrow();
        assertEquals("Nowhere", badCategory.values().get("Category"));
        assertEquals(List.of("Category"), badCategory.errorFields());
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Product>> saved = ArgumentCaptor.forClass(List.class);
        verify(products).saveAll(saved.capture());
        assertEquals(1, saved.getValue().size());
    }

    @Test
    void newProductsAreOwnedByTheCallingRetailerAndUseTheSharedFieldAssignment() {
        service.upload(csv("apple-1,  Apple ,groceries,Fresh red apples 1kg,100.5,20,active,\n"), Map.of());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Product>> saved = ArgumentCaptor.forClass(List.class);
        verify(products).saveAll(saved.capture());
        Product product = saved.getValue().get(0);
        assertEquals(retailerId, product.getRetailerId());
        assertEquals("APPLE-1", product.getSku());
        assertEquals("Apple", product.getName());
        assertEquals(groceries, product.getCategory());
        assertEquals(0, new BigDecimal("100.50").compareTo(product.getUnitPrice()));
        assertEquals(20, product.getStock());
        assertEquals(ProductStatus.ACTIVE, product.getStatus());
    }

    @Test
    void anExistingSkuWithDifferentDataNeverWritesAnythingUntilTheRetailerDecides() {
        when(products.findWithCategoryByRetailerIdAndSkuIn(any(), any()))
                .thenReturn(List.of(existing("ABC123", "Apple", fruits, "100.00", 20)));

        var response = service.upload(csv(
                "ABC123,Apple Premium,Groceries,Fresh red apples 1kg,120,30,ACTIVE,\n"
                        + "NEW-1,Banana,Fruits,Ripe yellow bananas,10,5,ACTIVE,\n"), Map.of());

        assertEquals("NEEDS_DECISIONS", response.status());
        assertEquals(1, response.conflicts().size());
        var conflict = response.conflicts().get(0);
        assertEquals("ABC123", conflict.sku());
        assertEquals("Apple", conflict.existingName());
        var fields = conflict.changes().stream().map(BulkProductUploadResponse.FieldChange::field).toList();
        assertTrue(fields.containsAll(List.of("Product Name", "Category", "Price", "Stock")));
        assertFalse(fields.contains("Status"), "only differing fields are shown");
        verify(products, never()).saveAll(any());
        verify(products, never()).addStock(anyLong(), any(), anyInt());
    }

    @Test
    void identicalExistingRowsAreNotConflicts() {
        Product apple = existing("ABC123", "Apple", fruits, "100.00", 20);
        when(products.findWithCategoryByRetailerIdAndSkuIn(any(), any())).thenReturn(List.of(apple));

        var response = service.upload(csv("ABC123,Apple,Fruits,\"Fresh red apples, 1kg\",100,20,ACTIVE,\n"), Map.of());

        assertEquals("COMPLETED", response.status());
        assertEquals(1, response.unchanged());
        assertTrue(response.conflicts().isEmpty());
    }

    @Test
    void updateDecisionChangesAllSuppliedFieldsAndAdjustsStockThroughTheExistingAtomicUpdate() {
        Product apple = existing("ABC123", "Apple", fruits, "100.00", 20);
        when(products.findWithCategoryByRetailerIdAndSkuIn(any(), any())).thenReturn(List.of(apple));
        when(products.addStock(99L, retailerId, 10)).thenReturn(1);

        var response = service.upload(csv("ABC123,Apple Premium,Groceries,Premium apples 1kg pack,120,30,DRAFT,7\n"),
                Map.of("ABC123", "UPDATE"));

        assertEquals("COMPLETED", response.status());
        assertEquals(1, response.updated());
        assertEquals("Apple Premium", apple.getName());
        assertEquals(groceries, apple.getCategory());
        assertEquals(0, new BigDecimal("120").compareTo(apple.getUnitPrice()));
        assertEquals(ProductStatus.DRAFT, apple.getStatus());
        assertEquals("Premium apples 1kg pack", apple.getDescription());
        assertEquals(7, apple.getLowStockThreshold());
        verify(products).addStock(99L, retailerId, 10);
        verify(products, never()).removeStock(anyLong(), any(), anyInt());
    }

    @Test
    void keepLeavesTheExistingProductAloneAndSkipIsReportedAsRejected() {
        Product apple = existing("ABC123", "Apple", fruits, "100.00", 20);
        Product pear = existing("DEF456", "Pear", fruits, "60.00", 5);
        when(products.findWithCategoryByRetailerIdAndSkuIn(any(), any())).thenReturn(List.of(apple, pear));

        var response = service.upload(csv(
                "ABC123,Apple Premium,Fruits,Fresh red apples 1kg,120,20,ACTIVE,\n"
                        + "DEF456,Pear Deluxe,Fruits,Juicy green pears 1kg,70,5,ACTIVE,\n"),
                Map.of("ABC123", "KEEP", "DEF456", "SKIP"));

        assertEquals("COMPLETED", response.status());
        assertEquals(0, response.updated());
        assertEquals(1, response.unchanged());
        assertEquals(1, response.rejected());
        assertTrue(response.rejectedRows().get(0).error().startsWith("Skipped at your request"));
        assertEquals("Apple", apple.getName());
        assertEquals("Pear", pear.getName());
    }

    private static MockMultipartFile csvWithWeight(String rows) {
        return new MockMultipartFile("file", "products.csv", "text/csv",
                ("SKU,Name,Category,Description,Unit Price,Stock,Weight (kg),Status\n" + rows).getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void weightIsOptionalAndBlankOrMissingMeansOneKg() {
        service.upload(csvWithWeight("A101,Apple,Groceries,Fresh red apples 1kg,100,5,2,ACTIVE\n"
                + "A102,Banana,Groceries,Ripe yellow bananas,50,5,,ACTIVE\n"), Map.of());
        // a file with no weight column at all is equally valid
        service.upload(csv("A103,Mango,Fruits,Sweet ripe mangoes,80,5,ACTIVE,\n"), Map.of());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Product>> saved = ArgumentCaptor.forClass(List.class);
        verify(products, times(2)).saveAll(saved.capture());
        Product a101 = saved.getAllValues().get(0).get(0);
        Product a102 = saved.getAllValues().get(0).get(1);
        Product a103 = saved.getAllValues().get(1).get(0);
        assertEquals(0, new BigDecimal("2").compareTo(a101.effectiveWeightKg()));
        assertEquals(0, BigDecimal.ONE.compareTo(a102.effectiveWeightKg()));
        assertEquals(0, BigDecimal.ONE.compareTo(a103.effectiveWeightKg()));
    }

    @Test
    void invalidWeightsAreRejectedWithAClearReason() {
        var response = service.upload(csvWithWeight(
                "W-TEXT,Apple,Groceries,Fresh red apples 1kg,100,5,heavy,ACTIVE\n"
                        + "W-ZERO,Apple,Groceries,Fresh red apples 1kg,100,5,0,ACTIVE\n"
                        + "W-NEG,Apple,Groceries,Fresh red apples 1kg,100,5,-2,ACTIVE\n"
                        + "W-OK,Apple,Groceries,Fresh red apples 1kg,100,5,0.5,ACTIVE\n"), Map.of());

        assertEquals(1, response.created());
        assertEquals(3, response.rejected());
        Map<String, String> errors = new java.util.HashMap<>();
        response.rejectedRows().forEach(row -> errors.put(row.values().get("SKU"), row.error()));
        assertEquals("Weight must be a number (in kg).", errors.get("W-TEXT"));
        assertEquals("Weight must be greater than 0 kg.", errors.get("W-ZERO"));
        assertEquals("Weight must be greater than 0 kg.", errors.get("W-NEG"));
        var rejected = response.rejectedRows().get(0);
        assertEquals(List.of("Weight (kg)"), rejected.errorFields());
        assertEquals("heavy", rejected.values().get("Weight (kg)"));
    }

    @Test
    void updatingAnExistingProductChangesItsWeightOnlyWhenTheRowSuppliesOne() {
        Product apple = existing("ABC123", "Apple", fruits, "100.00", 20);
        apple.setWeightKg(new BigDecimal("1.5"));
        when(products.findWithCategoryByRetailerIdAndSkuIn(any(), any())).thenReturn(List.of(apple));

        var conflict = service.upload(csvWithWeight("ABC123,Apple,Fruits,\"Fresh red apples, 1kg\",100,20,2.5,ACTIVE\n"), Map.of());
        assertEquals("NEEDS_DECISIONS", conflict.status());
        var change = conflict.conflicts().get(0).changes().get(0);
        assertEquals("Weight (kg)", change.field());
        assertEquals("1.5", change.existing());
        assertEquals("2.5", change.uploaded());

        service.upload(csvWithWeight("ABC123,Apple,Fruits,\"Fresh red apples, 1kg\",100,20,2.5,ACTIVE\n"), Map.of("ABC123", "UPDATE"));
        assertEquals(0, new BigDecimal("2.5").compareTo(apple.getWeightKg()));

        // blank weight on a later update keeps the weight the product already has
        service.upload(csvWithWeight("ABC123,Apple Premium,Fruits,\"Fresh red apples, 1kg\",100,20,,ACTIVE\n"), Map.of("ABC123", "UPDATE"));
        assertEquals(0, new BigDecimal("2.5").compareTo(apple.getWeightKg()));
    }

    @Test
    void duplicateSkusInsideTheFileAreRejectedAfterTheFirstOccurrence() {
        var response = service.upload(csv(
                "DUP-1,Apple,Groceries,Fresh red apples 1kg,100,20,ACTIVE,\n"
                        + "dup-1,Apple Two,Groceries,Fresh red apples 2kg,110,20,ACTIVE,\n"), Map.of());

        assertEquals(1, response.created());
        assertEquals(1, response.rejected());
        assertTrue(response.rejectedRows().get(0).error().contains("appears more than once"));
    }

    @Test
    void fileLevelProblemsAreRejectedBeforeAnyProcessing() {
        StringBuilder tooMany = new StringBuilder();
        for (int i = 0; i < 501; i++) {
            tooMany.append("SKU-").append(1000 + i).append(",Apple,Groceries,Fresh red apples 1kg,10,1,ACTIVE,\n");
        }
        assertTrue(assertThrows(BusinessValidationException.class, () -> service.upload(csv(tooMany.toString()), Map.of()))
                .getMessage().contains("more than 500"));

        assertTrue(assertThrows(BusinessValidationException.class, () -> service.upload(
                new MockMultipartFile("file", "products.xls", "application/vnd.ms-excel", new byte[] {1, 2, 3}), Map.of()))
                .getMessage().startsWith("Unsupported file type"));

        assertTrue(assertThrows(BusinessValidationException.class, () -> service.upload(
                new MockMultipartFile("file", "products.xlsx", "application/octet-stream", "not a workbook".getBytes()), Map.of()))
                .getMessage().contains("not a valid Excel"));

        assertTrue(assertThrows(BusinessValidationException.class, () -> service.upload(
                new MockMultipartFile("file", "p.csv", "text/csv", "SKU,Name\nA,B\n".getBytes()), Map.of()))
                .getMessage().contains("missing required column"));
        verify(products, never()).saveAll(any());
    }

    @Test
    void anXlsxUploadIsParsedAndTheRejectedReportRoundTripsWithAnErrorColumn() throws Exception {
        // Build an .xlsx with the same writer the rejected report uses, then upload it back.
        var rejected = new BulkProductUploadResponse.RejectedRow(2,
                new java.util.LinkedHashMap<>(Map.of("SKU", "X-1", "Name", "Apple", "Category", "Nowhere",
                        "Description", "Fresh red apples 1kg", "Unit Price", "10", "Stock", "1", "Status", "ACTIVE", "Low Stock Threshold", "")),
                "Category 'Nowhere' does not exist.", List.of("Category"));
        byte[] report = service.rejectedReport(List.of(rejected));
        assertTrue(report.length > 200);

        // The report is itself a valid upload file (header + original values; the extra Error column is ignored).
        var response = service.upload(new MockMultipartFile("file", "rejected-products.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", report), Map.of());
        assertEquals(1, response.totalRows());
        assertEquals(1, response.rejected(), "Category 'Nowhere' is still invalid, so it is rejected again");
        assertEquals("Category 'Nowhere' does not exist.", response.rejectedRows().get(0).error());
        assertEquals("X-1", response.rejectedRows().get(0).values().get("SKU"));
    }

    @Test
    void templateHeaderCarriesFieldGuidanceAndNoSeparateGuideOrImageColumns() throws Exception {
        groceries.setStatus(com.lbos.commercecustomer.enums.CategoryStatus.ACTIVE);
        fruits.setStatus(com.lbos.commercecustomer.enums.CategoryStatus.INACTIVE);

        String csv = new String(service.template("csv"), StandardCharsets.UTF_8);
        String expected = "\"SKU (Unique code, 3-20 letters, digits, '-' or '_')\",Name,Category (Active category name),"
                + "Description (10-300 characters),Unit Price,Stock,Weight (kg) (default 1 kg if not specified),"
                + "Status (Choose valid status: ACTIVE or DRAFT),Low Stock Threshold (Optional)";
        assertEquals(expected, csv.replace("﻿", "").trim());
        assertFalse(csv.toLowerCase().contains("image"));

        byte[] xlsx = service.template("xlsx");
        assertEquals('P', xlsx[0]);
    }

    // ---- the rejected products as CSV: the same table as the XLSX, exactly

    private BulkProductUploadResponse.RejectedRow awkwardRejectedRow() {
        Map<String, String> values = new java.util.LinkedHashMap<>();
        values.put("SKU", "A,1");
        values.put("Name", "He said \"hi\"");
        values.put("Category", "Fruits");
        values.put("Description", "line one\nline two");
        values.put("Unit Price", "-50");
        values.put("Stock", "10");
        values.put("Weight (kg)", "5");
        values.put("Status", "ACTIVE");
        values.put("Low Stock Threshold", "");
        return new BulkProductUploadResponse.RejectedRow(2, values, "Price must be greater than zero", List.of("Unit Price"));
    }

    @Test
    void theRejectedCsvHasEveryOriginalColumnPlusErrorAndEscapesCommasQuotesAndLineBreaks() {
        String csv = new String(service.rejectedReportCsv(List.of(awkwardRejectedRow())), StandardCharsets.UTF_8);

        String expected = "\uFEFF"
                + "SKU,Name,Category,Description,Unit Price,Stock,Weight (kg),Status,Low Stock Threshold,Error\r\n"
                + "\"A,1\",\"He said \"\"hi\"\"\",Fruits,\"line one\nline two\",-50,10,5,ACTIVE,,Price must be greater than zero\r\n";
        assertEquals(expected, csv);
    }

    @Test
    void theRejectedCsvHasOneLinePerRejectedRowAndKeepsTheOriginalValuesUntouched() {
        var first = awkwardRejectedRow();
        var second = new BulkProductUploadResponse.RejectedRow(5, new java.util.LinkedHashMap<>(Map.of("SKU", "  RICE-5KG ", "Name", "Rice", "Category", "Groceries",
                "Description", "Long grain rice 5 kg", "Unit Price", "abc", "Stock", "10", "Weight (kg)", "5", "Status", "ACTIVE", "Low Stock Threshold", "")),
                "Unit Price must be a number", List.of("Unit Price"));

        String csv = new String(service.rejectedReportCsv(List.of(first, second)), StandardCharsets.UTF_8);

        assertTrue(csv.contains("  RICE-5KG ,Rice,Groceries,Long grain rice 5 kg,abc,10,5,ACTIVE,,Unit Price must be a number\r\n"), "spaces and text are kept exactly");
        assertEquals(3, csv.split("\r\n", -1).length - 1, "header + two rows, each ending in CRLF (the line break inside quotes is a plain LF)");
    }

    @Test
    void thereIsNoCsvOrXlsxWithoutRejectedRows() {
        assertThrows(BusinessValidationException.class, () -> service.rejectedReportCsv(List.of()));
        assertThrows(BusinessValidationException.class, () -> service.rejectedReportCsv(null));
        assertThrows(BusinessValidationException.class, () -> service.rejectedReport(List.of()));
    }

    @Test
    void theXlsxAndTheCsvCarryTheSameRowsAndValues() {
        var rejected = List.of(awkwardRejectedRow());

        // each report is itself a valid upload file (header + values; Error is ignored), so reading both back shows what they hold
        var fromXlsx = service.upload(new MockMultipartFile("file", "rejected-products.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", service.rejectedReport(rejected)), Map.of());
        var fromCsv = service.upload(new MockMultipartFile("file", "rejected-products.csv", "text/csv", service.rejectedReportCsv(rejected)), Map.of());

        assertEquals(1, fromXlsx.rejectedRows().size());
        assertEquals(fromXlsx.rejectedRows().get(0).values(), fromCsv.rejectedRows().get(0).values());
        assertEquals(awkwardRejectedRow().values().get("Description"), fromCsv.rejectedRows().get(0).values().get("Description"));
        assertEquals(awkwardRejectedRow().values().get("Name"), fromCsv.rejectedRows().get(0).values().get("Name"));
        assertEquals(fromXlsx.rejectedRows().get(0).error(), fromCsv.rejectedRows().get(0).error());
    }
}
