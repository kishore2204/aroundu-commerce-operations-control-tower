package com.cbg.lbos.controller;

import com.cbg.lbos.client.S2PartnerClient;
import com.cbg.lbos.dto.*;
import com.cbg.lbos.entity.*;
import com.cbg.lbos.service.*;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/assignments")
public class VehicleAssignmentController {
	private final VehicleAssignmentService assignmentService;

	private final S2PartnerClient partnerClient;

	public VehicleAssignmentController(VehicleAssignmentService assignmentService, S2PartnerClient partnerClient) {
		this.assignmentService = assignmentService;
		this.partnerClient = partnerClient;
	}

	@PostMapping
	public VehicleAssignmentDto create(@RequestBody VehicleAssignmentDto assignmentDto) {
		return assignmentService.create(assignmentDto);
	}

	@GetMapping("/{id}")
	public VehicleAssignmentDto get(@PathVariable UUID id) {
		return assignmentService.get(id);
	}

	@GetMapping
	public List<VehicleAssignmentDto> all() {
		return assignmentService.getAll();
	}

	/** Fleet-owner-facing: assignments for this fleet owner's own vehicles. */
	@GetMapping("/mine")
	public List<VehicleAssignmentDto> mine(
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
		return assignmentService.getByFleetOwner(targetId);
	}


	@DeleteMapping("/{id}")
	public void delete(@PathVariable UUID id) {
		assignmentService.delete(id);
	}

	@GetMapping("/active")
	public List<VehicleAssignmentDto> active() {
		return assignmentService.active();
	}

	@PatchMapping("/{id}/end")
	public VehicleAssignmentDto end(@PathVariable UUID id) {
		return assignmentService.end(id);
	}

	@GetMapping("/reliability")
	public AssignmentReliabilityDto reliability(@RequestParam(required = false) UUID vehicleId,
			@RequestParam(required = false) UUID driverId) {
		return assignmentService.reliability(vehicleId, driverId);
	}

	/**
	 * Operations-manager tool: pairs up a fleet owner's currently idle vehicles and drivers,
	 * least-utilized first, so future work spreads across the fleet instead of repeatedly
	 * reusing the same few vehicles/drivers. Does not touch any already-active assignment.
	 */
	@PostMapping("/rebalance")
	public RebalanceResultDto rebalance(@RequestParam UUID fleetOwnerId) {
		return assignmentService.rebalance(fleetOwnerId);
	}
}
