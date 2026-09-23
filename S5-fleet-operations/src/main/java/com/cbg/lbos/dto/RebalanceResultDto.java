package com.cbg.lbos.dto;

import java.util.List;
import java.util.UUID;

public record RebalanceResultDto(
		UUID fleetOwnerId,
		int newAssignmentsCreated,
		List<Pairing> pairings,
		int vehiclesLeftUnpaired,
		int driversLeftUnpaired) {

	/** One newly created assignment, with the load counts (pre-rebalance) that drove the pairing. */
	public record Pairing(UUID vehicleId, long vehiclePriorAssignmentCount, UUID driverId, long driverPriorAssignmentCount) {
	}
}
