package com.cbg.lbos.controller;

import com.cbg.lbos.client.S2PartnerClient;
import com.cbg.lbos.dto.*;
import com.cbg.lbos.entity.*;
import com.cbg.lbos.service.*;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/drivers")
public class DriverController {
	private final DriverService driverService;

	private final S2PartnerClient partnerClient;

	public DriverController(DriverService driverService, S2PartnerClient partnerClient) {
		this.driverService = driverService;
		this.partnerClient = partnerClient;
	}

	@PostMapping
	public DriverDto create(@RequestBody DriverDto driverDto, org.springframework.security.core.Authentication authentication) {
		if (driverDto.getFleetOwnerId() == null && authentication != null && authentication.getName() != null) {
			try {
				UUID userAccountId = UUID.fromString(authentication.getName());
				FleetOwnerValidationDto validation = partnerClient.getFleetOwnerByUserAccountId(userAccountId);
				if (validation != null) {
					driverDto.setFleetOwnerId(validation.getFleetOwnerId());
				}
			} catch (Exception ignored) {
			}
		}
		return driverService.create(driverDto);
	}

	@GetMapping("/{id}")
	public DriverDto get(@PathVariable UUID id) {
		return driverService.get(id);
	}

	/** Driver-app self-lookup: the authenticated driver's own record (driverId, fleetOwnerId,
	 *  etc.) - needed by the driver dashboard since a DRIVER token has no other way to learn
	 *  its own fleetOwnerId (S2's getFleetOwnerByUserAccountId only resolves a fleet owner's
	 *  own account, not a driver's). Matched before "/{id}" by Spring MVC's more-specific-first
	 *  rule, so "me" is never mistaken for a path variable. */
	@GetMapping("/me")
	public DriverDto me(org.springframework.security.core.Authentication authentication) {
		if (authentication == null || authentication.getName() == null) {
			throw new IllegalStateException("No authenticated user on this request");
		}
		UUID userAccountId = UUID.fromString(authentication.getName());
		return driverService.getByUserAccountId(userAccountId);
	}

	public record UpdateLicenseRequest(String licenseNumber, java.time.LocalDate licenseExpiryDate) {
	}

	/** Self-service profile edit - see DriverService.updateLicense(). */
	@PutMapping("/me")
	public DriverDto updateMe(@RequestBody UpdateLicenseRequest request, org.springframework.security.core.Authentication authentication) {
		if (authentication == null || authentication.getName() == null) {
			throw new IllegalStateException("No authenticated user on this request");
		}
		UUID userAccountId = UUID.fromString(authentication.getName());
		DriverDto mine = driverService.getByUserAccountId(userAccountId);
		return driverService.updateLicense(mine.getDriverId(), request.licenseNumber(), request.licenseExpiryDate());
	}

	@GetMapping
	public List<DriverDto> all() {
		return driverService.getAll();
	}

	/** Fleet-owner-facing: this fleet owner's own drivers. */
	@GetMapping("/mine")
	public List<DriverDto> mine(
			@RequestParam(required = false) UUID fleetOwnerId,
			org.springframework.security.core.Authentication authentication) {
		UUID targetId = fleetOwnerId;
		if (targetId == null && authentication != null && authentication.getName() != null) {
			try {
				UUID userAccountId = UUID.fromString(authentication.getName());
				FleetOwnerValidationDto validation = partnerClient.getFleetOwnerByUserAccountId(userAccountId);
				if (validation != null) {
					targetId = validation.getFleetOwnerId();
				}
			} catch (Exception ignored) {
			}
		}
		if (targetId == null) {
			return Collections.emptyList();
		}
		return driverService.getByFleetOwner(targetId);
	}


	@DeleteMapping("/{id}")
	public void delete(@PathVariable UUID id) {
		driverService.delete(id);
	}

	@GetMapping("/available")
	public List<DriverDto> available() {
		return driverService.available();
	}

	@PatchMapping("/{id}/status")
	public DriverDto status(@PathVariable UUID id, @RequestParam DriverStatus status) {
		return driverService.changeStatus(id, status);
	}

	public record SubmitForVerificationRequest(UUID submittedByAccountId) {
	}

	public record SubmitForVerificationResponse(UUID verificationQueueId) {
	}

	/**
	 * Submits an INACTIVE driver's documents into S2's existing verification workflow (the
	 * same one used for Retailer/FleetOwner onboarding) so it can move to ACTIVE once approved.
	 * submittedByAccountId is passed explicitly, matching this codebase's existing convention
	 * of passing account ids explicitly rather than deriving them from a security context (e.g.
	 * VehicleAssignment.assignedByAccountId, FleetExpense.createdByAccountId).
	 */
	@PostMapping("/{id}/submit-for-verification")
	public SubmitForVerificationResponse submitForVerification(@PathVariable UUID id,
			@RequestBody SubmitForVerificationRequest request) {
		UUID verificationQueueId = driverService.submitForVerification(id, request.submittedByAccountId());
		return new SubmitForVerificationResponse(verificationQueueId);
	}
}
