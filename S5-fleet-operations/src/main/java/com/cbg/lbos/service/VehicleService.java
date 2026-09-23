package com.cbg.lbos.service;

import com.cbg.lbos.dto.*;
import com.cbg.lbos.entity.*;
import java.util.*;

public interface VehicleService {
	VehicleDto create(VehicleDto vehicleDto);

	VehicleDto get(UUID id);

	List<VehicleDto> getAll();

	/** Fleet-owner-facing: this fleet owner's own vehicles - backs GET /api/vehicles/mine. */
	List<VehicleDto> getByFleetOwner(UUID fleetOwnerId);

	List<VehicleDto> available();

	/**
	 * ACTIVE, unassigned vehicles nearest to (lat,lon), sorted nearest-first, capped to maxKm
	 * when given. Used to notify the nearest fleet owner once a retailer accepts a retail order
	 * - see S4's OrderService.retailerAccept() and the new internal endpoint on
	 * InternalFleetController.
	 */
	List<VehicleDto> nearestAvailable(java.math.BigDecimal lat, java.math.BigDecimal lon, Double maxKm);

	VehicleDto changeStatus(UUID id, VehicleStatus vehicleStatus, UUID accountId);

	/** Service-to-service: S2 flips the vehicle straight to ACTIVE once its documents clear verification. */
	VehicleDto activate(UUID id);

	/** Fleet-owner-facing: submits an INACTIVE vehicle's documents into S2's verification workflow. */
	UUID submitForVerification(UUID id, UUID submittedByAccountId);

	void delete(UUID id);
}
