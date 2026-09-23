package com.example.lbos.controller;

import com.example.lbos.dto.VerificationDocumentDTO;
import com.example.lbos.exception.VerificationDocumentNotFoundException;
import com.example.lbos.service.VerificationDocumentService;
import jakarta.validation.Valid;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/verification-documents")
@Tag(name = "Verification Document", description = "APIs for managing verification documents")
public class VerificationDocumentController {

    private final VerificationDocumentService service;
    private final com.example.lbos.service.VerificationQueueService queueService;
    private final com.example.lbos.security.ZoneScope zoneScope;

    public VerificationDocumentController(VerificationDocumentService service,
            com.example.lbos.service.VerificationQueueService queueService, com.example.lbos.security.ZoneScope zoneScope) {
        this.service = service;
        this.queueService = queueService;
        this.zoneScope = zoneScope;
    }

    /** A Location Manager may only work with documents of requests in their zone (or assigned to them). */
    private void requireQueueInScope(UUID verificationQueueId) {
        if (com.example.lbos.security.ZoneScope.isLocationManager()) {
            zoneScope.requireVisible(queueService.getVerificationQueueById(verificationQueueId));
        }
    }

    private void requireDocumentInScope(UUID documentId) {
        if (com.example.lbos.security.ZoneScope.isLocationManager()) {
            requireQueueInScope(service.getVerificationDocumentById(documentId).getVerificationQueueId());
        }
    }

    @PostMapping
    @Operation(summary = "Create verification document", description = "Creates a new verification document")
    @ApiResponse(responseCode = "201", description = "Verification document created successfully")
    @ApiResponse(responseCode = "400", description = "Invalid request")
    public ResponseEntity<VerificationDocumentDTO> createVerificationDocument(@Valid @RequestBody VerificationDocumentDTO dto) {
        VerificationDocumentDTO created = service.createVerificationDocument(dto);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload a verification document file",
            description = "Uploads a PDF/JPG/JPEG/PNG file (max 10MB) for a verification queue entry. "
                    + "Creates the next version of the named document type: any existing current version "
                    + "for that queue+type is superseded, and the new upload starts as PENDING.")
    @ApiResponse(responseCode = "201", description = "Document uploaded successfully")
    @ApiResponse(responseCode = "400", description = "Invalid file (empty, oversized, or unsupported type) or invalid request")
    @ApiResponse(responseCode = "404", description = "Verification queue not found")
    public ResponseEntity<VerificationDocumentDTO> uploadVerificationDocument(
            @RequestParam("verificationQueueId") UUID verificationQueueId,
            @RequestParam("documentTypeName") String documentTypeName,
            @RequestParam(value = "expiryDate", required = false)
            @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
            LocalDate expiryDate,
            @Parameter(description = "The document file (PDF, JPG, JPEG, or PNG; max 10MB)", required = true,
                    content = @Content(mediaType = MediaType.APPLICATION_OCTET_STREAM_VALUE, schema = @Schema(type = "string", format = "binary")))
            @RequestParam("file") MultipartFile file) {
        VerificationDocumentDTO created = service.uploadVerificationDocument(
                verificationQueueId, documentTypeName, expiryDate, file);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @GetMapping
    @Operation(summary = "Get all verification documents", description = "Retrieves a list of all verification documents")
    @ApiResponse(responseCode = "200", description = "Successful operation")
    public ResponseEntity<List<VerificationDocumentDTO>> getAllVerificationDocuments() {
        return ResponseEntity.ok(service.getAllVerificationDocuments());
    }

    @GetMapping("/{documentId}")
    @Operation(summary = "Get a verification document by ID", description = "Retrieves a single verification document by its ID")
    @ApiResponse(responseCode = "200", description = "Successful operation")
    @ApiResponse(responseCode = "404", description = "Verification document not found")
    public ResponseEntity<VerificationDocumentDTO> getVerificationDocumentById(@PathVariable UUID documentId) {
        requireDocumentInScope(documentId);
        return ResponseEntity.ok(service.getVerificationDocumentById(documentId));
    }

    @PutMapping("/{documentId}")
    @Operation(summary = "Update a verification document", description = "Updates an existing verification document by its ID")
    @ApiResponse(responseCode = "200", description = "Verification document updated successfully")
    @ApiResponse(responseCode = "404", description = "Verification document not found")
    public ResponseEntity<VerificationDocumentDTO> updateVerificationDocument(@PathVariable UUID documentId, @Valid @RequestBody VerificationDocumentDTO dto) {
        return ResponseEntity.ok(service.updateVerificationDocument(documentId, dto));
    }

    @DeleteMapping("/{documentId}")
    @Operation(summary = "Delete a verification document", description = "Deletes an existing verification document by its ID")
    @ApiResponse(responseCode = "200", description = "Verification document deleted successfully")
    @ApiResponse(responseCode = "404", description = "Verification document not found")
    public ResponseEntity<Void> deleteVerificationDocument(@PathVariable UUID documentId) {
        service.deleteVerificationDocument(documentId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{documentId}/decision")
    @Operation(summary = "Review one verification document",
            description = "Approves one current document or rejects only that document for resubmission")
    public ResponseEntity<VerificationDocumentDTO> decideVerificationDocument(
            @PathVariable UUID documentId, @RequestBody java.util.Map<String, String> payload) {
        requireDocumentInScope(documentId);
        return ResponseEntity.ok(service.decideVerificationDocument(
                documentId, payload.get("result"), payload.get("reason")));
    }

    @GetMapping("/{documentId}/file")
    @Operation(summary = "Download a verification document's file",
            description = "Returns the raw stored file bytes for the given document, with the appropriate "
                    + "Content-Type and Content-Disposition headers.")
    @ApiResponse(responseCode = "200", description = "File content",
            content = @Content(mediaType = MediaType.APPLICATION_OCTET_STREAM_VALUE, schema = @Schema(type = "string", format = "binary")))
    @ApiResponse(responseCode = "404", description = "Verification document not found, or has no stored file content")
    public ResponseEntity<byte[]> downloadVerificationDocumentFile(@PathVariable UUID documentId) {
        requireDocumentInScope(documentId);
        VerificationDocumentService.DocumentFile file = service.getVerificationDocumentFile(documentId)
                .orElseThrow(() -> new VerificationDocumentNotFoundException(
                        "VerificationDocument not found or has no stored file content for id: " + documentId));

        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(file.contentType());
        } catch (Exception e) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }

        String fileName = file.fileName() == null ? "document" : file.fileName();
        ContentDisposition disposition = ContentDisposition.attachment().filename(fileName).build();

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(file.content());
    }

    @GetMapping("/queue/{verificationQueueId}/history")
    @Operation(summary = "Get the version history of one document",
            description = "Every uploaded version (newest first) of the named document type in a queue, with uploader, status and reviewer note")
    public ResponseEntity<List<com.example.lbos.dto.DocumentVersionDTO>> getDocumentHistory(
            @PathVariable UUID verificationQueueId, @RequestParam("documentTypeName") String documentTypeName) {
        requireQueueInScope(verificationQueueId);
        return ResponseEntity.ok(service.getDocumentHistory(verificationQueueId, documentTypeName));
    }

    @GetMapping("/queue/{verificationQueueId}")
    @Operation(summary = "Get verification documents by Queue ID", description = "Retrieves all verification documents for a specific queue")
    public ResponseEntity<List<VerificationDocumentDTO>> getVerificationDocumentsByQueueId(@PathVariable UUID verificationQueueId) {
        requireQueueInScope(verificationQueueId);
        return ResponseEntity.ok(service.getVerificationDocumentsByQueueId(verificationQueueId));
    }

    @GetMapping("/status/{status}")
    @Operation(summary = "Get verification documents by Status", description = "Retrieves all verification documents by their status")
    public ResponseEntity<List<VerificationDocumentDTO>> getVerificationDocumentsByStatus(@PathVariable String status) {
        return ResponseEntity.ok(service.getVerificationDocumentsByStatus(status));
    }

    @GetMapping("/current/{current}")
    @Operation(summary = "Get verification documents by Is Current Version", description = "Retrieves all verification documents by their isCurrentVersion flag")
    public ResponseEntity<List<VerificationDocumentDTO>> getVerificationDocumentsByIsCurrentVersion(@PathVariable Boolean current) {
        return ResponseEntity.ok(service.getVerificationDocumentsByIsCurrent(current));
    }
}
