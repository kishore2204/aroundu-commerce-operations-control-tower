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

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Fleet-Owner-initiated Vehicle onboarding - see FleetOwnerDriverController for the equivalent
 * Driver flow and the rationale (creates the record in S5, opens a common verification-queue
 * entry, no separate/duplicated verification API).
 */
@RestController
@RequestMapping("/api/fleet-owners/{fleetOwnerId}/vehicles")
@Tag(name = "Fleet Owner Vehicles", description = "Fleet-Owner-initiated Vehicle onboarding, routed through the common verification workflow")
public class FleetOwnerVehicleController {

    public record AddVehicleRequest(@NotBlank(message = BusinessIdentifierRules.VEHICLE_REQUIRED_MESSAGE)
                                     @Pattern(regexp = BusinessIdentifierRules.VEHICLE_REGEX, message = BusinessIdentifierRules.VEHICLE_MESSAGE)
                                     String registrationNumber, @NotBlank String vehicleType,
                                     @NotBlank String make, @NotBlank String model,
                                     @NotNull Integer modelYear, @NotNull BigDecimal capacityKg) {
        /** The registration number is normalised (upper-case, no spaces or hyphens) before it is checked and forwarded to S5. */
        public AddVehicleRequest {
            registrationNumber = BusinessIdentifierRules.normalizeCompact(registrationNumber);
        }
    }

    public record AddVehicleResponse(UUID vehicleId, UUID verificationQueueId, String verificationStatus) {
    }

    private final FleetOwnerAssetService fleetOwnerAssetService;
    private final FleetOwnerService fleetOwnerService;

    public FleetOwnerVehicleController(FleetOwnerAssetService fleetOwnerAssetService, FleetOwnerService fleetOwnerService) {
        this.fleetOwnerAssetService = fleetOwnerAssetService;
        this.fleetOwnerService = fleetOwnerService;
    }

    @PostMapping
    @Operation(summary = "Add a vehicle", description = "Creates a vehicle under this (verified, active) fleet owner in S5 and opens a common verification-queue entry for it")
    @ApiResponse(responseCode = "201", description = "Vehicle created, verification queue opened")
    @ApiResponse(responseCode = "403", description = "Not this fleet owner's profile, or the fleet owner is not yet verified/active")
    @ApiResponse(responseCode = "404", description = "Fleet owner not found")
    public ResponseEntity<AddVehicleResponse> add(@PathVariable UUID fleetOwnerId,
            @Valid @RequestBody AddVehicleRequest request, Authentication authentication) {
        requireOwnerOrAdmin(fleetOwnerId, authentication);
        UUID callerAccountId = resolveAuthenticatedUserAccountId(authentication);
        FleetOwnerAssetService.AddVehicleResult result = fleetOwnerAssetService.addVehicle(fleetOwnerId,
                new FleetOwnerAssetService.AddVehicleCommand(request.registrationNumber(), request.vehicleType(),
                        request.make(), request.model(), request.modelYear(), request.capacityKg(), callerAccountId));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new AddVehicleResponse(result.vehicleId(), result.verificationQueueId(), result.verificationStatus()));
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
