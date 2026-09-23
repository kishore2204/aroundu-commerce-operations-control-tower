package com.cbg.lbos.service;

import com.cbg.lbos.dto.*;
import com.cbg.lbos.entity.*;
import java.util.*;

public interface DriverService {
	DriverDto create(DriverDto driverDto);

	DriverDto get(UUID id);

	DriverDto getByUserAccountId(UUID userAccountId);

	List<DriverDto> getAll();

	/** Fleet-owner-facing: this fleet owner's own drivers - backs GET /api/drivers/mine. */
	List<DriverDto> getByFleetOwner(UUID fleetOwnerId);

	List<DriverDto> available();

	/**
	 * ACTIVE, unassigned drivers nearest to (lat,lon), sorted nearest-first, capped to maxKm
	 * when given. See VehicleService.nearestAvailable() for the matching vehicle-side lookup.
	 */
	List<DriverDto> nearestAvailable(java.math.BigDecimal lat, java.math.BigDecimal lon, Double maxKm);

	DriverDto changeStatus(UUID id, DriverStatus driverStatus);

	/** Self-service: a driver editing their own license number/expiry from their profile page.
	 *  Only these two fields - cityId/fleetOwnerId/status changes stay fleet-manager/staff
	 *  actions, not something a driver edits on themselves. */
	DriverDto updateLicense(UUID id, String licenseNumber, java.time.LocalDate licenseExpiryDate);

	/** Service-to-service: S2 flips the driver straight to ACTIVE once its documents clear verification. */
	DriverDto activate(UUID id);

	/** Fleet-owner-facing: submits an INACTIVE driver's documents into S2's verification workflow. */
	UUID submitForVerification(UUID id, UUID submittedByAccountId);

	void delete(UUID id);
}
