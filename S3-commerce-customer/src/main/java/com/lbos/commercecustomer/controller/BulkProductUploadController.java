package com.lbos.commercecustomer.controller;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lbos.commercecustomer.dto.response.ApiResponse;
import com.lbos.commercecustomer.dto.response.BulkProductUploadResponse;
import com.lbos.commercecustomer.dto.response.BulkProductUploadResponse.RejectedReportRequest;
import com.lbos.commercecustomer.exception.BusinessValidationException;
import com.lbos.commercecustomer.service.impl.BulkProductUploadService;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Retailer bulk product upload. Lives under /api/v1/retailers/me/products, so the existing
 * RETAILER-only rule for that prefix (SecurityConfig / Gateway) applies unchanged, and every
 * operation is scoped to the calling retailer's own products by the service.
 */
@RestController
@RequestMapping("/api/v1/retailers/me/products/bulk-upload")
public class BulkProductUploadController {

    private static final MediaType XLSX =
            MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final BulkProductUploadService service;
    private final ObjectMapper objectMapper;

    public BulkProductUploadController(BulkProductUploadService service, ObjectMapper objectMapper) {
        this.service = service;
        this.objectMapper = objectMapper;
    }

    /**
     * Uploads a .xlsx/.csv file. {@code decisions} (optional JSON, SKU -> UPDATE|KEEP|SKIP) answers
     * the conflicts a previous call reported; without them, a file that touches existing products
     * with different data returns NEEDS_DECISIONS and changes nothing.
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<BulkProductUploadResponse> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "decisions", required = false) String decisions,
            HttpServletRequest request) {
        BulkProductUploadResponse result = service.upload(file, parseDecisions(decisions));
        return ApiResponse.of(
                Optional.ofNullable(request.getHeader("X-Correlation-Id")).orElse("not-provided"),
                "COMPLETED".equals(result.status()) ? "Bulk upload processed" : "Decisions required", result);
    }

    /** Both formats carry the field guidance directly in their header row - there is no separate guide file. */
    @GetMapping("/template")
    public ResponseEntity<byte[]> template(@RequestParam(defaultValue = "xlsx") String format) {
        boolean csv = "csv".equalsIgnoreCase(format);
        return download(service.template(format), csv ? MediaType.parseMediaType("text/csv;charset=UTF-8") : XLSX,
                csv ? "product-upload-template.csv" : "product-upload-template.xlsx");
    }

    /** The rejected rows (original values + Error) built from the rows the upload returned: XLSX by default, or CSV with {@code ?format=csv}. */
    @PostMapping("/rejected-report")
    public ResponseEntity<byte[]> rejectedReport(@RequestBody RejectedReportRequest body,
            @RequestParam(defaultValue = "xlsx") String format) {
        var rows = body == null ? null : body.rows();
        if ("csv".equalsIgnoreCase(format)) {
            return download(service.rejectedReportCsv(rows), MediaType.parseMediaType("text/csv;charset=UTF-8"), "rejected-products.csv");
        }
        return download(service.rejectedReport(rows), XLSX, "rejected-products.xlsx");
    }

    private Map<String, String> parseDecisions(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            Map<String, String> parsed = objectMapper.readValue(json, new TypeReference<Map<String, String>>() { });
            Map<String, String> normalized = new HashMap<>();
            parsed.forEach((sku, decision) -> normalized.put(sku.trim().toUpperCase(), decision));
            return normalized;
        } catch (JsonProcessingException invalid) {
            throw new BusinessValidationException("The selected actions could not be read. Please try again.");
        }
    }

    private static ResponseEntity<byte[]> download(byte[] content, MediaType type, String fileName) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(fileName).build().toString())
                .contentType(type)
                .body(content);
    }
}
