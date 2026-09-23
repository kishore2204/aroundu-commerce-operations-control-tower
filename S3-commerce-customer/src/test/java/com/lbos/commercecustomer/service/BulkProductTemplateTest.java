package com.lbos.commercecustomer.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;

import com.lbos.commercecustomer.dto.client.partner.RetailerContextResponse;
import com.lbos.commercecustomer.entity.ProductCategory;
import com.lbos.commercecustomer.enums.CategoryStatus;
import com.lbos.commercecustomer.enums.ProductStatus;
import com.lbos.commercecustomer.repository.ProductCategoryRepository;
import com.lbos.commercecustomer.repository.ProductRepository;
import com.lbos.commercecustomer.service.impl.BulkProductUploadService;
import com.lbos.commercecustomer.service.impl.ContextSupport;

import jakarta.validation.Validation;

/**
 * The downloadable bulk-upload templates are built from the CURRENT categories and product statuses every time, and
 * there is no separate guide file of any kind: the field guidance lives directly in the header row of both formats.
 * The XLSX additionally gets real Category / Status dropdowns across the whole entry range, sourced from a hidden
 * "Lists" sheet. Both templates still upload as-is (the parser never mistakes the header, or a blank row, for a
 * product record).
 */
@ExtendWith(MockitoExtension.class)
class BulkProductTemplateTest {

    @Mock private ProductRepository products;
    @Mock private ProductCategoryRepository categories;
    @Mock private ContextSupport ctx;
    @Mock private PlatformTransactionManager transactionManager;

    private BulkProductUploadService service;
    private ProductCategory groceries;
    private ProductCategory fruits;
    private ProductCategory dairy;

    @BeforeEach
    void setUp() {
        service = new BulkProductUploadService(products, categories, ctx,
                Validation.buildDefaultValidatorFactory().getValidator(), transactionManager);
        lenient().when(ctx.retailer()).thenReturn(new RetailerContextResponse(UUID.randomUUID(), UUID.randomUUID(), "Shop", UUID.randomUUID()));
        lenient().when(products.findWithCategoryByRetailerIdAndSkuIn(any(), any())).thenReturn(List.of());
        groceries = category(1L, "Groceries & Staples", CategoryStatus.ACTIVE);
        fruits = category(2L, "Fruits", CategoryStatus.INACTIVE);
        dairy = category(3L, "Dairy, Eggs", CategoryStatus.ACTIVE);
        lenient().when(categories.findAll()).thenReturn(List.of(groceries, fruits, dairy));
    }

    private static ProductCategory category(long id, String name, CategoryStatus status) {
        ProductCategory category = new ProductCategory();
        category.setId(id);
        category.setName(name);
        category.setStatus(status);
        return category;
    }

    /** Every part of the xlsx (a zip) by path, as text. */
    private static Map<String, String> unzip(byte[] xlsx) throws IOException {
        Map<String, String> parts = new HashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(xlsx))) {
            for (ZipEntry entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                parts.put(entry.getName(), new String(zip.readAllBytes(), StandardCharsets.UTF_8));
            }
        }
        return parts;
    }

    @Test
    void theXlsxHasOnlyTheProductsAndHiddenListsSheets_noInstructionsSheet() throws Exception {
        String workbook = unzip(service.template("xlsx")).get("xl/workbook.xml");

        assertTrue(workbook.contains("<sheet name=\"Products\" sheetId=\"1\""), workbook);
        assertTrue(workbook.contains("<sheet name=\"Lists\" sheetId=\"2\" state=\"hidden\""), workbook);
        assertFalse(workbook.toLowerCase().contains("instructions"), "the rejected visible field-guide sheet must not exist");
    }

    @Test
    void theXlsxHasRealDropdownsForCategoryAndStatusAcrossTheFullEntryRangeOnly() throws Exception {
        Map<String, String> parts = unzip(service.template("xlsx"));
        String sheet = parts.get("xl/worksheets/sheet1.xml");

        // Category is column C, Status column H, on rows 2..501 (the upload maximum is 500 rows)
        assertTrue(sheet.contains("sqref=\"C2:C501\"><formula1>CategoryList</formula1>"), sheet);
        assertTrue(sheet.contains("sqref=\"H2:H501\"><formula1>StatusList</formula1>"), sheet);
        assertEquals(2, count(sheet, "type=\"list\""), "only Category and Status are dropdowns");
        assertEquals(2, count(sheet, "<dataValidation "), "no other column gets a per-cell validation any more - guidance lives in the header");
        assertTrue(sheet.contains("state=\"frozen\""), "the header stays visible while scrolling");
    }

    @Test
    void theXlsxHeaderRowCarriesTheFieldGuidanceFromTheRealValidationRules() throws Exception {
        String sheet = unzip(service.template("xlsx")).get("xl/worksheets/sheet1.xml");

        assertTrue(sheet.contains(">SKU (Unique code, 3-20 letters, digits, &apos;-&apos; or &apos;_&apos;)<")
                || sheet.contains(">SKU (Unique code, 3-20 letters, digits, '-' or '_')<"), sheet);
        assertTrue(sheet.contains(">Name<"));
        assertTrue(sheet.contains(">Category<"), "Category stays plain in the XLSX - the cell dropdown supplies the guidance");
        assertTrue(sheet.contains(">Description (10-300 characters)<"));
        assertTrue(sheet.contains(">Unit Price<"));
        assertTrue(sheet.contains(">Stock<"));
        assertTrue(sheet.contains(">Weight (kg) (default 1 kg if not specified)<"));
        assertTrue(sheet.contains(">Status<"), "Status stays plain in the XLSX - the cell dropdown supplies the guidance");
        assertTrue(sheet.contains(">Low Stock Threshold (Optional)<"));
    }

    @Test
    void theProductsSheetHasBlankDataEntryRowsReadyToFillIn() throws Exception {
        String sheet = unzip(service.template("xlsx")).get("xl/worksheets/sheet1.xml");
        assertTrue(count(sheet, "<row ") >= 10, "several rows below the header, ready for data entry: " + sheet);
    }

    @Test
    void theDropdownListsHoldOnlyTheActiveCategoriesAndTheCurrentStatusValues() throws Exception {
        Map<String, String> parts = unzip(service.template("xlsx"));
        String workbook = parts.get("xl/workbook.xml");
        String lists = parts.get("xl/worksheets/sheet2.xml");

        assertTrue(workbook.contains("<definedName name=\"CategoryList\">Lists!$A$2:$A$3</definedName>"), workbook);
        assertTrue(workbook.contains("<definedName name=\"StatusList\">Lists!$B$2:$B$" + (ProductStatus.values().length + 1) + "</definedName>"), workbook);
        assertTrue(lists.contains("Groceries &amp; Staples") && lists.contains("Dairy, Eggs"), lists);
        assertFalse(lists.contains("Fruits"), "an inactive category is not offered");
        for (ProductStatus status : ProductStatus.values()) {
            assertTrue(lists.contains(">" + status.name() + "<"), status.name());
        }
        assertFalse(lists.contains("INACTIVE"), "only statuses the product model really has");
    }

    @Test
    void aNewlyActivatedCategoryAppearsAndADeactivatedOneDisappearsInTheNextDownload() throws Exception {
        assertFalse(unzip(service.template("xlsx")).get("xl/worksheets/sheet2.xml").contains("Fruits"));

        fruits.setStatus(CategoryStatus.ACTIVE);
        groceries.setStatus(CategoryStatus.INACTIVE);
        Map<String, String> after = unzip(service.template("xlsx"));

        assertTrue(after.get("xl/worksheets/sheet2.xml").contains("Fruits"));
        assertFalse(after.get("xl/worksheets/sheet2.xml").contains("Groceries"), "a deactivated category is no longer offered");
        assertTrue(after.get("xl/workbook.xml").contains("Lists!$A$2:$A$3"));
    }

    @Test
    void withNoActiveCategoryTheDropdownRangeStaysValid() throws Exception {
        groceries.setStatus(CategoryStatus.INACTIVE);
        dairy.setStatus(CategoryStatus.INACTIVE);

        Map<String, String> parts = unzip(service.template("xlsx"));

        assertTrue(parts.get("xl/workbook.xml").contains("Lists!$A$2:$A$2"), "never an inverted range");
    }

    @Test
    void theCsvTemplateHeaderCarriesTheSameGuidanceWithCategoryAndStatusSpelledOutInWords() {
        String header = new String(service.template("csv"), StandardCharsets.UTF_8).replace("﻿", "").trim();

        String expected = "\"SKU (Unique code, 3-20 letters, digits, '-' or '_')\",Name,Category (Active category name),"
                + "Description (10-300 characters),Unit Price,Stock,Weight (kg) (default 1 kg if not specified),"
                + "Status (Choose valid status: ACTIVE or DRAFT),Low Stock Threshold (Optional)";
        assertEquals(expected, header);
    }

    @Test
    void aBlankTemplateHasNoProductRows_theHeaderGuidanceIsNotReadAsData() {
        var xlsx = new MockMultipartFile("file", "product-upload-template.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", service.template("xlsx"));
        var csv = new MockMultipartFile("file", "product-upload-template.csv", "text/csv", service.template("csv"));

        // the header row is found (no "missing column" error) and nothing else in the file counts as a product
        for (MockMultipartFile file : List.of(xlsx, csv)) {
            var failure = org.junit.jupiter.api.Assertions.assertThrows(com.lbos.commercecustomer.exception.BusinessValidationException.class,
                    () -> service.upload(file, Map.of()));
            assertEquals("The file has no product rows. Add a header row and at least one product.", failure.getMessage());
        }
    }

    /** The generated workbook with one product row added to "Products" - i.e. what a retailer does after downloading it. */
    private static byte[] withProductRow(byte[] xlsx, String... values) throws IOException {
        StringBuilder row = new StringBuilder("<row r=\"9999\">");
        for (int column = 0; column < values.length; column++) {
            row.append("<c r=\"").append((char) ('A' + column)).append("9999\" t=\"inlineStr\"><is><t>")
                    .append(values[column].replace("&", "&amp;")).append("</t></is></c>");
        }
        row.append("</row>");
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(xlsx)); java.util.zip.ZipOutputStream zip = new java.util.zip.ZipOutputStream(out)) {
            for (ZipEntry entry = in.getNextEntry(); entry != null; entry = in.getNextEntry()) {
                String content = new String(in.readAllBytes(), StandardCharsets.UTF_8);
                if (entry.getName().equals("xl/worksheets/sheet1.xml")) {
                    content = content.replace("</sheetData>", row + "</sheetData>");
                }
                zip.putNextEntry(new ZipEntry(entry.getName()));
                zip.write(content.getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return out.toByteArray();
    }

    @Test
    void theGeneratedXlsxWithARowFilledInStillUploadsThroughTheSameParser() throws Exception {
        byte[] filled = withProductRow(service.template("xlsx"), "T-1", "Tea Powder", "Groceries & Staples", "Strong assam tea powder", "120", "10", "0.5", "ACTIVE", "2");

        var result = service.upload(new MockMultipartFile("file", "product-upload-template.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filled), Map.of());

        assertEquals(1, result.totalRows(), "the hidden sheet and the blank entry rows are not product rows");
        assertEquals(1, result.created());
        assertEquals(0, result.rejected());
    }

    @Test
    void aFilledInTemplateRowIsAcceptedThroughTheSameParser() throws Exception {
        // a template row filled in under the guided CSV header, as the header text guided it
        String csv = new String(service.template("csv"), StandardCharsets.UTF_8)
                + "T-1,Tea Powder,Groceries & Staples,Strong assam tea powder,120,10,0.5,ACTIVE,2\r\n";

        var result = service.upload(new MockMultipartFile("file", "filled.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8)), Map.of());

        assertEquals(1, result.totalRows());
        assertEquals(1, result.created());
        assertEquals(0, result.rejected());
    }

    @Test
    void invalidCategoryOrStatusTypedDirectlyBypassingTheDropdownIsStillRejectedByBackendValidation() throws Exception {
        String csv = new String(service.template("csv"), StandardCharsets.UTF_8)
                + "T-2,Tea Powder,Nonexistent Category,Strong assam tea powder,120,10,0.5,ACTIVE,2\r\n"
                + "T-3,Tea Powder,Groceries & Staples,Strong assam tea powder,120,10,0.5,NOT_A_STATUS,2\r\n";

        var result = service.upload(new MockMultipartFile("file", "filled.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8)), Map.of());

        assertEquals(2, result.totalRows());
        assertEquals(2, result.rejected(), "the Excel dropdown is guidance only - the backend still authoritatively validates");
        assertEquals(0, result.created());
    }

    private static int count(String text, String part) {
        int total = 0;
        for (int at = text.indexOf(part); at >= 0; at = text.indexOf(part, at + part.length())) {
            total++;
        }
        return total;
    }
}
