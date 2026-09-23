package com.cbg.lbos.service;

import com.cbg.lbos.dto.*;
import java.util.*;

public interface VehicleAssignmentService {
	VehicleAssignmentDto create(VehicleAssignmentDto assignmentDto);

	VehicleAssignmentDto get(UUID id);

	List<VehicleAssignmentDto> getAll();

	/** Fleet-owner-facing: assignments for this fleet owner's own vehicles - backs GET /api/assignments/mine. */
	List<VehicleAssignmentDto> getByFleetOwner(UUID fleetOwnerId);

	List<VehicleAssignmentDto> active();

	VehicleAssignmentDto end(UUID id);

	void delete(UUID id);

	AssignmentReliabilityDto reliability(UUID vehicleId, UUID driverId);

	RebalanceResultDto rebalance(UUID fleetOwnerId);
}
