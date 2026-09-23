package com.example.lbos.controller;

import com.example.lbos.exception.ForbiddenActionException;
import com.example.lbos.exception.MissingAuthenticatedUserException;
import com.example.lbos.service.FleetOwnerAssetService;
import com.example.lbos.service.FleetOwnerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import com.example.lbos.validation.BusinessIdentifierRules;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Fleet-Owner-initiated Driver onboarding: creates the Driver record in S5 (owner of driver
 * operational data, see S5FleetClient.createDriver) and opens an entry in S2's existing common
 * VerificationQueue/VerificationDocument workflow - the same one Retailer/FleetOwner onboarding
 * already uses, rather than a separate, duplicated verification path (see
 * FleetOwnerAssetServiceImpl). After this call: upload each required document via
 * POST /api/verification-documents/upload (verificationQueueId from this response), then finish
 * with POST /api/verification-queues/{id}/submit-for-verification to dispatch to the Location
 * Manager active in the fleet owner's zone.
 */
@RestController
@RequestMapping("/api/fleet-owners/{fleetOwnerId}/drivers")
@Tag(name = "Fleet Owner Drivers", description = "Fleet-Owner-initiated Driver onboarding, routed through the common verification workflow")
public class FleetOwnerDriverController {

    public record AddDriverRequest(@NotNull UUID userAccountId, @NotNull UUID cityId,
                                    @NotBlank(message = BusinessIdentifierRules.LICENCE_REQUIRED_MESSAGE)
                                    @Pattern(regexp = BusinessIdentifierRules.LICENCE_REGEX, message = BusinessIdentifierRules.LICENCE_MESSAGE)
                                    String licenseNumber, @NotNull LocalDate licenseExpiryDate) {
        /** The licence is normalised (upper-case, no spaces or hyphens) before it is checked and forwarded to S5. */
        public AddDriverRequest {
            licenseNumber = BusinessIdentifierRules.normalizeCompact(licenseNumber);
        }
    }

    public record AddDriverResponse(UUID driverId, UUID verificationQueueId, String verificationStatus) {
    }

    private final FleetOwnerAssetService fleetOwnerAssetService;
    private final FleetOwnerService fleetOwnerService;

    public FleetOwnerDriverController(FleetOwnerAssetService fleetOwnerAssetService, FleetOwnerService fleetOwnerService) {
        this.fleetOwnerAssetService = fleetOwnerAssetService;
        this.fleetOwnerService = fleetOwnerService;
    }

    @PostMapping
    @Operation(summary = "Add a driver", description = "Creates a driver under this (verified, active) fleet owner in S5 and opens a common verification-queue entry for it")
    @ApiResponse(responseCode = "201", description = "Driver created, verification queue opened")
    @ApiResponse(responseCode = "403", description = "Not this fleet owner's profile, or the fleet owner is not yet verified/active")
    @ApiResponse(responseCode = "404", description = "Fleet owner not found")
    public ResponseEntity<AddDriverResponse> add(@PathVariable UUID fleetOwnerId,
            @Valid @RequestBody AddDriverRequest request, Authentication authentication) {
        requireOwnerOrAdmin(fleetOwnerId, authentication);
        UUID callerAccountId = resolveAuthenticatedUserAccountId(authentication);
        FleetOwnerAssetService.AddDriverResult result = fleetOwnerAssetService.addDriver(fleetOwnerId,
                new FleetOwnerAssetService.AddDriverCommand(request.userAccountId(), request.cityId(),
                        request.licenseNumber(), request.licenseExpiryDate(), callerAccountId));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new AddDriverResponse(result.driverId(), result.verificationQueueId(), result.verificationStatus()));
    }

    private void requireOwnerOrAdmin(UUID fleetOwnerId, Authentication authentication) {
        UUID authenticatedUserAccountId = resolveAuthenticatedUserAccountId(authentication);
        if (isStaff(authentication)) {
            return;
        }
        var existing = fleetOwnerService.getFleetOwnerById(fleetOwnerId);
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
