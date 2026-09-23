package com.example.lbos.controller;

import com.example.lbos.dto.FleetOwnerDTO;
import com.example.lbos.exception.ForbiddenActionException;
import com.example.lbos.exception.MissingAuthenticatedUserException;
import com.example.lbos.service.FleetOwnerService;
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
@RequestMapping("/api/fleet-owners")
@Tag(name = "Fleet Owner", description = "APIs for managing fleet owners")
public class FleetOwnerController {

    private final FleetOwnerService service;
    private final com.example.lbos.security.ZoneScope zoneScope;

    public FleetOwnerController(FleetOwnerService service, com.example.lbos.security.ZoneScope zoneScope) {
        this.service = service;
        this.zoneScope = zoneScope;
    }

    /** A Location Manager only ever gets the fleet owners registered in their own zone; every other role gets the list unchanged. */
    private List<FleetOwnerDTO> inMyZone(List<FleetOwnerDTO> owners) {
        if (!com.example.lbos.security.ZoneScope.isLocationManager()) {
            return owners;
        }
        java.util.UUID zone = zoneScope.zoneId();
        return owners.stream().filter(owner -> zone.equals(owner.getZoneId())).toList();
    }

    @PostMapping("/register")
    @Operation(summary = "Register fleet owner", description = "Registers a new fleet owner with pending verification status")
    @ApiResponse(responseCode = "201", description = "Fleet owner registered successfully")
    @ApiResponse(responseCode = "400", description = "Invalid request")
    public ResponseEntity<FleetOwnerDTO> registerFleetOwner(@Valid @RequestBody FleetOwnerDTO fleetOwnerDTO, Authentication authentication) {
        applyOwnerIdentity(fleetOwnerDTO, authentication);
        FleetOwnerDTO created = service.registerFleetOwner(fleetOwnerDTO);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @PostMapping
    @Operation(summary = "Create fleet owner", description = "Creates a new fleet owner")
    @ApiResponse(responseCode = "201", description = "Fleet owner created successfully")
    @ApiResponse(responseCode = "400", description = "Invalid request")
    public ResponseEntity<FleetOwnerDTO> createFleetOwner(@Valid @RequestBody FleetOwnerDTO fleetOwnerDTO, Authentication authentication) {
        applyOwnerIdentity(fleetOwnerDTO, authentication);
        FleetOwnerDTO created = service.createFleetOwner(fleetOwnerDTO);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @GetMapping
    @Operation(summary = "Get all fleet owners", description = "Retrieves a list of all fleet owners")
    @ApiResponse(responseCode = "200", description = "Successful operation")
    public ResponseEntity<List<FleetOwnerDTO>> getAllFleetOwners() {
        return ResponseEntity.ok(inMyZone(service.getAllFleetOwners()));
    }

    /**
     * The authenticated caller's own fleet-owner profile, looked up directly by userAccountId -
     * the single-row equivalent of what the Angular FleetOwnerService used to resolve by fetching
     * every fleet owner and filtering client-side (mirrors RetailerController.getMyRetailer()).
     */
    @GetMapping("/me")
    @Operation(summary = "Get my fleet owner profile", description = "Retrieves the fleet owner profile owned by the authenticated user")
    @ApiResponse(responseCode = "200", description = "Successful operation")
    @ApiResponse(responseCode = "404", description = "The authenticated user has no fleet-owner profile")
    public ResponseEntity<FleetOwnerDTO> getMyFleetOwner(Authentication authentication) {
        UUID authenticatedUserAccountId = resolveAuthenticatedUserAccountId(authentication);
        return ResponseEntity.ok(service.getFleetOwnerByUserAccountId(authenticatedUserAccountId));
    }

    @GetMapping("/{fleetOwnerId}")
    @Operation(summary = "Get a fleet owner by ID", description = "Retrieves a single fleet owner by its ID")
    @ApiResponse(responseCode = "200", description = "Successful operation")
    @ApiResponse(responseCode = "404", description = "Fleet owner not found")
    public ResponseEntity<FleetOwnerDTO> getFleetOwnerById(@PathVariable UUID fleetOwnerId) {
        FleetOwnerDTO owner = service.getFleetOwnerById(fleetOwnerId);
        if (com.example.lbos.security.ZoneScope.isLocationManager()) {
            zoneScope.requireZone(owner.getZoneId());
        }
        return ResponseEntity.ok(owner);
    }

    @PutMapping("/{fleetOwnerId}")
    @Operation(summary = "Update a fleet owner", description = "Updates an existing fleet owner by its ID")
    @ApiResponse(responseCode = "200", description = "Fleet owner updated successfully")
    @ApiResponse(responseCode = "404", description = "Fleet owner not found")
    public ResponseEntity<FleetOwnerDTO> updateFleetOwner(@PathVariable UUID fleetOwnerId, @Valid @RequestBody FleetOwnerDTO dto, Authentication authentication) {
        requireOwnerOrAdmin(fleetOwnerId, authentication);
        return ResponseEntity.ok(service.updateFleetOwner(fleetOwnerId, dto));
    }

    @DeleteMapping("/{fleetOwnerId}")
    @Operation(summary = "Delete a fleet owner", description = "Deletes an existing fleet owner by its ID")
    @ApiResponse(responseCode = "200", description = "Fleet owner deleted successfully")
    @ApiResponse(responseCode = "404", description = "Fleet owner not found")
    public ResponseEntity<Void> deleteFleetOwner(@PathVariable UUID fleetOwnerId, Authentication authentication) {
        requireOwnerOrAdmin(fleetOwnerId, authentication);
        service.deleteFleetOwner(fleetOwnerId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/city/{cityId}")
    @Operation(summary = "Get fleet owners by City", description = "Retrieves all fleet owners in a specific city")
    public ResponseEntity<List<FleetOwnerDTO>> getFleetOwnersByCityId(@PathVariable UUID cityId) {
        return ResponseEntity.ok(inMyZone(service.getFleetOwnersByCityId(cityId)));
    }

    @GetMapping("/status/{status}")
    @Operation(summary = "Get fleet owners by Status", description = "Retrieves all fleet owners by their owner status")
    public ResponseEntity<List<FleetOwnerDTO>> getFleetOwnersByStatus(@PathVariable String status) {
        return ResponseEntity.ok(inMyZone(service.getFleetOwnersByStatus(status)));
    }

    @GetMapping("/profile-status/{status}")
    @Operation(summary = "Get fleet owners by Profile Status", description = "Retrieves all fleet owners by their profile verification status")
    public ResponseEntity<List<FleetOwnerDTO>> getFleetOwnersByProfileStatus(@PathVariable String status) {
        return ResponseEntity.ok(inMyZone(service.getFleetOwnersByProfileStatus(status)));
    }

    @GetMapping("/search")
    @Operation(summary = "Search fleet owners", description = "Searches for fleet owners by business name")
    public ResponseEntity<List<FleetOwnerDTO>> searchFleetOwners(@RequestParam String businessName) {
        return ResponseEntity.ok(inMyZone(service.searchFleetOwnersByBusinessName(businessName)));
    }

    @PostMapping("/{fleetOwnerId}/documents")
    @Operation(summary = "Submit documents", description = "Submits verification documents for a fleet owner; returns the verification queue id so the caller can follow up with real file uploads via POST /api/verification-documents/upload")
    @ApiResponse(responseCode = "200", description = "Documents submitted successfully")
    public ResponseEntity<java.util.Map<String, UUID>> submitFleetOwnerDocuments(@PathVariable UUID fleetOwnerId, @RequestBody List<com.example.lbos.dto.VerificationDocumentDTO> documents) {
        UUID verificationQueueId = service.submitFleetOwnerDocuments(fleetOwnerId, documents);
        return ResponseEntity.ok(java.util.Map.of("verificationQueueId", verificationQueueId));
    }

    @PostMapping("/{fleetOwnerId}/submit-verification")
    @Operation(summary = "Submit for verification", description = "Submits the fleet owner's verification queue to the Location Manager")
    @ApiResponse(responseCode = "200", description = "Submitted successfully")
    public ResponseEntity<Void> submitFleetOwnerForVerification(@PathVariable UUID fleetOwnerId) {
        service.submitFleetOwnerForVerification(fleetOwnerId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{fleetOwnerId}/verification-status")
    @Operation(summary = "Get verification status", description = "Retrieves the verification status of a fleet owner")
    @ApiResponse(responseCode = "200", description = "Status retrieved successfully")
    public ResponseEntity<java.util.Map<String, String>> getFleetOwnerVerificationStatus(@PathVariable UUID fleetOwnerId) {
        String status = service.getFleetOwnerVerificationStatus(fleetOwnerId);
        String rejectionReason = service.getFleetOwnerVerificationRejectionReason(fleetOwnerId);
        java.util.Map<String, String> body = new java.util.HashMap<>();
        body.put("status", status);
        if (rejectionReason != null) {
            body.put("rejectionReason", rejectionReason);
        }
        service.getActiveVerificationQueueForSubjectForController(fleetOwnerId).ifPresent(queue -> {
            body.put("verificationQueueId", queue.getVerificationQueueId().toString());
            String rejectedDocuments = service.getRejectedCurrentDocumentTypesForController(queue.getVerificationQueueId());
            if (!rejectedDocuments.isBlank()) body.put("rejectedDocuments", rejectedDocuments);
        });
        return ResponseEntity.ok(body);
    }

    /**
     * A regular caller always registers/creates a fleet-owner profile for themselves - the
     * client-supplied userAccountId is overwritten with the JWT subject so nobody can create
     * a partner profile under someone else's account. Staff (SUPER_ADMIN/OPERATIONS_MANAGER)
     * may still create a profile on a partner's behalf by supplying userAccountId explicitly.
     */
    private void applyOwnerIdentity(FleetOwnerDTO fleetOwnerDTO, Authentication authentication) {
        UUID authenticatedUserAccountId = resolveAuthenticatedUserAccountId(authentication);
        if (!isStaff(authentication) || fleetOwnerDTO.getUserAccountId() == null) {
            fleetOwnerDTO.setUserAccountId(authenticatedUserAccountId);
        }
    }

    private void requireOwnerOrAdmin(UUID fleetOwnerId, Authentication authentication) {
        UUID authenticatedUserAccountId = resolveAuthenticatedUserAccountId(authentication);
        if (isStaff(authentication)) {
            return;
        }
        FleetOwnerDTO existing = service.getFleetOwnerById(fleetOwnerId);
        if (!authenticatedUserAccountId.equals(existing.getUserAccountId())) {
            throw new ForbiddenActionException("You do not own this fleet-owner profile");
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
