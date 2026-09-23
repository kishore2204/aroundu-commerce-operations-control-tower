package com.cbg.lbos.controller;

import com.cbg.lbos.client.S2PartnerClient;
import com.cbg.lbos.dto.*;
import com.cbg.lbos.entity.*;
import com.cbg.lbos.service.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/vehicles")
public class VehicleController {
	private final VehicleService vehicleService;

	private final S2PartnerClient partnerClient;

	public VehicleController(VehicleService vehicleService, S2PartnerClient partnerClient) {
		this.vehicleService = vehicleService;
		this.partnerClient = partnerClient;
	}

	@PostMapping
	public VehicleDto create(@RequestBody VehicleDto vehicleDto, Authentication authentication) {
		if (vehicleDto.getFleetOwnerId() == null && authentication != null && authentication.getName() != null) {
			try {
				UUID userAccountId = UUID.fromString(authentication.getName());
				FleetOwnerValidationDto validation = partnerClient.getFleetOwnerByUserAccountId(userAccountId);
				if (validation != null) {
					vehicleDto.setFleetOwnerId(validation.getFleetOwnerId());
				}
			} catch (Exception ignored) {
			}
		}
		return vehicleService.create(vehicleDto);
	}

	@GetMapping("/{id}")
	public VehicleDto get(@PathVariable UUID id) {
		return vehicleService.get(id);
	}

	@GetMapping
	public List<VehicleDto> all() {
		return vehicleService.getAll();
	}

	/** Fleet-owner-facing: this fleet owner's own vehicles. */
	@GetMapping("/mine")
	public List<VehicleDto> mine(
			@RequestParam(required = false) UUID fleetOwnerId,
			Authentication authentication) {
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
		return vehicleService.getByFleetOwner(targetId);
	}


	@DeleteMapping("/{id}")
	public void delete(@PathVariable UUID id) {
		vehicleService.delete(id);
	}

	@GetMapping("/available")
	public List<VehicleDto> available() {
		return vehicleService.available();
	}

	/*
	 * accountId used to come straight from a query param - anyone could stamp any account as
	 * having made a status change. It's now always the authenticated caller.
	 */
	@PatchMapping("/{id}/status")
	public VehicleDto status(@PathVariable UUID id, @RequestParam VehicleStatus status, Authentication authentication) {
		return vehicleService.changeStatus(id, status, resolveAuthenticatedUserAccountId(authentication));
	}

	private UUID resolveAuthenticatedUserAccountId(Authentication authentication) {
		if (authentication == null || authentication.getName() == null) {
			throw new IllegalStateException("No authenticated user on this request");
		}
		try {
			return UUID.fromString(authentication.getName());
		} catch (IllegalArgumentException invalidSubjectException) {
			throw new IllegalStateException("Authenticated subject is not a valid user account id");
		}
	}

	public record SubmitForVerificationRequest(UUID submittedByAccountId) {
	}

	public record SubmitForVerificationResponse(UUID verificationQueueId) {
	}

	/**
	 * Submits an INACTIVE vehicle's documents into S2's existing verification workflow (the
	 * same one used for Retailer/FleetOwner onboarding) so it can move to ACTIVE once approved.
	 * submittedByAccountId is passed explicitly, matching this codebase's existing convention
	 * of passing account ids explicitly rather than deriving them from a security context (e.g.
	 * VehicleAssignment.assignedByAccountId, FleetExpense.createdByAccountId).
	 */
	@PostMapping("/{id}/submit-for-verification")
	public SubmitForVerificationResponse submitForVerification(@PathVariable UUID id,
			@RequestBody SubmitForVerificationRequest request) {
		UUID verificationQueueId = vehicleService.submitForVerification(id, request.submittedByAccountId());
		return new SubmitForVerificationResponse(verificationQueueId);
	}
}
