package com.example.lbos.controller;

import com.example.lbos.dto.RetailerDTO;
import com.example.lbos.exception.ForbiddenActionException;
import com.example.lbos.exception.MissingAuthenticatedUserException;
import com.example.lbos.service.RetailerService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/retailers")
@Tag(name = "Retailer", description = "APIs for managing retailers")
public class RetailerController {

    private final RetailerService retailerService;
    private final com.example.lbos.security.ZoneScope zoneScope;

    public RetailerController(RetailerService retailerService, com.example.lbos.security.ZoneScope zoneScope) {
        this.retailerService = retailerService;
        this.zoneScope = zoneScope;
    }

    /** A Location Manager only ever gets the retailers registered in their own zone; every other role gets the list unchanged. */
    private List<RetailerDTO> inMyZone(List<RetailerDTO> retailers) {
        if (!com.example.lbos.security.ZoneScope.isLocationManager()) {
            return retailers;
        }
        java.util.UUID zone = zoneScope.zoneId();
        return retailers.stream().filter(retailer -> zone.equals(retailer.getZoneId())).toList();
    }

    @PostMapping("/register")
    @Operation(summary = "Register retailer", description = "Registers a new retailer with pending verification status")
    @ApiResponse(responseCode = "201", description = "Retailer registered successfully")
    @ApiResponse(responseCode = "400", description = "Invalid request")
    public ResponseEntity<RetailerDTO> registerRetailer(@Valid @RequestBody RetailerDTO retailerDTO, Authentication authentication) {
        applyOwnerIdentity(retailerDTO, authentication);
        RetailerDTO created = retailerService.registerRetailer(retailerDTO);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @PostMapping
    @Operation(summary = "Create retailer", description = "Creates a new retailer")
    @ApiResponse(responseCode = "201", description = "Retailer created successfully")
    @ApiResponse(responseCode = "400", description = "Invalid request")
    public ResponseEntity<RetailerDTO> createRetailer(@Valid @RequestBody RetailerDTO retailerDTO, Authentication authentication) {
        applyOwnerIdentity(retailerDTO, authentication);
        RetailerDTO created = retailerService.createRetailer(retailerDTO);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @GetMapping
    @Operation(summary = "Get all retailers", description = "Retrieves a list of all retailers")
    @ApiResponse(responseCode = "200", description = "Successful operation")
    public ResponseEntity<List<RetailerDTO>> getAllRetailers() {
        return ResponseEntity.ok(inMyZone(retailerService.getAllRetailers()));
    }

    /**
     * The authenticated caller's own retailer profile, looked up directly by userAccountId - the
     * single-row equivalent of what the Angular RetailerService used to resolve by fetching every
     * retailer and filtering client-side (there was no other way to reach this by-user lookup
     * through the Gateway; the equivalent internal endpoint is service-to-service only).
     */
    @GetMapping("/me")
    @Operation(summary = "Get my retailer profile", description = "Retrieves the retailer profile owned by the authenticated user")
    @ApiResponse(responseCode = "200", description = "Successful operation")
    @ApiResponse(responseCode = "404", description = "The authenticated user has no retailer profile")
    public ResponseEntity<RetailerDTO> getMyRetailer(Authentication authentication) {
        UUID authenticatedUserAccountId = resolveAuthenticatedUserAccountId(authentication);
        return ResponseEntity.ok(retailerService.getRetailerByUserAccountId(authenticatedUserAccountId));
    }

    @GetMapping("/{retailerId}")
    @Operation(summary = "Get a retailer by ID", description = "Retrieves a single retailer by its ID")
    @ApiResponse(responseCode = "200", description = "Successful operation")
    @ApiResponse(responseCode = "404", description = "Retailer not found")
    public ResponseEntity<RetailerDTO> getRetailerById(@PathVariable UUID retailerId) {
        RetailerDTO retailer = retailerService.getRetailerById(retailerId);
        if (com.example.lbos.security.ZoneScope.isLocationManager()) {
            zoneScope.requireZone(retailer.getZoneId());
        }
        return ResponseEntity.ok(retailer);
    }

    @PutMapping("/{retailerId}")
    @Operation(summary = "Update a retailer", description = "Updates an existing retailer by its ID")
    @ApiResponse(responseCode = "200", description = "Retailer updated successfully")
    @ApiResponse(responseCode = "404", description = "Retailer not found")
    public ResponseEntity<RetailerDTO> updateRetailer(@PathVariable UUID retailerId, @Valid @RequestBody RetailerDTO retailerDTO, Authentication authentication) {
        requireOwnerOrAdmin(retailerId, authentication);
        return ResponseEntity.ok(retailerService.updateRetailer(retailerId, retailerDTO));
    }

    @DeleteMapping("/{retailerId}")
    @Operation(summary = "Delete a retailer", description = "Deletes an existing retailer by its ID")
    @ApiResponse(responseCode = "200", description = "Retailer deleted successfully")
    @ApiResponse(responseCode = "404", description = "Retailer not found")
    public ResponseEntity<Void> deleteRetailer(@PathVariable UUID retailerId, Authentication authentication) {
        requireOwnerOrAdmin(retailerId, authentication);
        retailerService.deleteRetailer(retailerId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/city/{cityId}")
    @Operation(summary = "Get retailers by City", description = "Retrieves all retailers in a specific city")
    public ResponseEntity<List<RetailerDTO>> getRetailersByCity(@PathVariable UUID cityId) {
        return ResponseEntity.ok(inMyZone(retailerService.getRetailersByCity(cityId)));
    }

    @GetMapping("/status/{status}")
    @Operation(summary = "Get retailers by Status", description = "Retrieves all retailers by their status")
    public ResponseEntity<List<RetailerDTO>> getRetailersByStatus(@PathVariable String status) {
        return ResponseEntity.ok(inMyZone(retailerService.getRetailersByStatus(status)));
    }

    @GetMapping("/search")
    @Operation(summary = "Search retailers", description = "Searches for retailers by business name (partial match)")
    public ResponseEntity<List<RetailerDTO>> searchRetailers(@RequestParam String businessName) {
        return ResponseEntity.ok(inMyZone(retailerService.searchRetailers(businessName)));
    }

    @PostMapping("/{retailerId}/documents")
    @Operation(summary = "Submit documents", description = "Submits verification documents for a retailer")
    @ApiResponse(responseCode = "200", description = "Documents submitted successfully")
    public ResponseEntity<java.util.Map<String, UUID>> submitRetailerDocuments(@PathVariable UUID retailerId, @RequestBody List<com.example.lbos.dto.VerificationDocumentDTO> documents) {
        UUID verificationQueueId = retailerService.submitRetailerDocuments(retailerId, documents);
        return ResponseEntity.ok(java.util.Map.of("verificationQueueId", verificationQueueId));
    }

    @PostMapping("/{retailerId}/submit-verification")
    @Operation(summary = "Submit for verification", description = "Submits the retailer's verification queue to the Location Manager")
    @ApiResponse(responseCode = "200", description = "Submitted successfully")
    public ResponseEntity<Void> submitRetailerForVerification(@PathVariable UUID retailerId) {
        retailerService.submitRetailerForVerification(retailerId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{retailerId}/verification-status")
    @Operation(summary = "Get verification status", description = "Retrieves the verification status of a retailer")
    @ApiResponse(responseCode = "200", description = "Status retrieved successfully")
    public ResponseEntity<java.util.Map<String, String>> getRetailerVerificationStatus(@PathVariable UUID retailerId) {
        String status = retailerService.getRetailerVerificationStatus(retailerId);
        String rejectionReason = retailerService.getRetailerVerificationRejectionReason(retailerId);
        java.util.Map<String, String> body = new java.util.HashMap<>();
        body.put("status", status);
        if (rejectionReason != null) {
            body.put("rejectionReason", rejectionReason);
        }
        retailerService.getActiveVerificationQueueForSubjectForController(retailerId).ifPresent(queue -> {
            body.put("verificationQueueId", queue.getVerificationQueueId().toString());
            String rejectedDocuments = retailerService.getRejectedCurrentDocumentTypesForController(queue.getVerificationQueueId());
            if (!rejectedDocuments.isBlank()) body.put("rejectedDocuments", rejectedDocuments);
        });
        return ResponseEntity.ok(body);
    }

    /**
     * A regular caller always registers/creates a retailer profile for themselves - the
     * client-supplied userAccountId is overwritten with the JWT subject so nobody can create
     * a partner profile under someone else's account. Staff (SUPER_ADMIN/OPERATIONS_MANAGER)
     * may still create a profile on a partner's behalf by supplying userAccountId explicitly.
     */
    private void applyOwnerIdentity(RetailerDTO retailerDTO, Authentication authentication) {
        UUID authenticatedUserAccountId = resolveAuthenticatedUserAccountId(authentication);
        if (!isStaff(authentication) || retailerDTO.getUserAccountId() == null) {
            retailerDTO.setUserAccountId(authenticatedUserAccountId);
        }
    }

    private void requireOwnerOrAdmin(UUID retailerId, Authentication authentication) {
        UUID authenticatedUserAccountId = resolveAuthenticatedUserAccountId(authentication);
        if (isStaff(authentication)) {
            return;
        }
        RetailerDTO existing = retailerService.getRetailerById(retailerId);
        if (!authenticatedUserAccountId.equals(existing.getUserAccountId())) {
            throw new ForbiddenActionException("You do not own this retailer profile");
        }
    }

    private boolean isStaff(Authentication authentication) {
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority -> authority.equals("ROLE_SUPER_ADMIN") || authority.equals("ROLE_OPERATIONS_MANAGER"));
    }

    private UUID resolveAuthenticatedUserAccountId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new MissingAuthenticatedUserException("No authenticated user on this request");
        }
        try {
            return UUID.fromString(authentication.getName());
        } catch (IllegalArgumentException invalidSubjectException) {
            throw new MissingAuthenticatedUserException("Authenticated subject is not a valid user account id");
        }
    }
}
