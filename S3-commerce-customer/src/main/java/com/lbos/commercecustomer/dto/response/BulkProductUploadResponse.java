package com.lbos.commercecustomer.dto.response;

import java.util.List;
import java.util.Map;

/**
 * Outcome of a retailer bulk product upload. Nothing here exposes ids - products are identified by
 * SKU and name, categories by name.
 *
 * <p>{@code status} is NEEDS_DECISIONS when at least one uploaded SKU already exists with different
 * data and the retailer has not yet said what to do with it: nothing has been written in that case
 * and {@code conflicts} lists what differs. Otherwise it is COMPLETED and the counts describe what
 * was written.
 */
public record BulkProductUploadResponse(
        String status,
        int totalRows,
        List<Conflict> conflicts,
        int created,
        int updated,
        int unchanged,
        int rejected,
        List<RejectedRow> rejectedRows) {

    /** One field that differs between the existing product and the uploaded row. */
    public record FieldChange(String field, String existing, String uploaded) {
    }

    /** An uploaded SKU that already exists with different data - the retailer must choose. */
    public record Conflict(String sku, String existingName, List<FieldChange> changes) {
    }

    /**
     * A row that was not applied. {@code values} holds the ORIGINAL uploaded cell values keyed by
     * column name (in column order); {@code errorFields} names the columns to highlight.
     */
    public record RejectedRow(int rowNumber, Map<String, String> values, String error, List<String> errorFields) {
    }

    /** Request body for downloading the rejected-rows report. */
    public record RejectedReportRequest(List<RejectedRow> rows) {
    }
}
