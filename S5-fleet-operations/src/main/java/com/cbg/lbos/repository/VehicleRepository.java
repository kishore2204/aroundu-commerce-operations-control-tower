package com.cbg.lbos.repository;

import com.cbg.lbos.entity.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface VehicleRepository extends JpaRepository<Vehicle, UUID> {
	boolean existsByRegistrationNumber(String registrationNumber);

	List<Vehicle> findByVehicleStatus(VehicleStatus vehicleStatus);

	List<Vehicle> findByFleetOwnerIdAndVehicleStatus(java.util.UUID fleetOwnerId, VehicleStatus vehicleStatus);

	/** Backs GET /api/vehicles/mine - a fleet owner's own vehicles, regardless of status. */
	List<Vehicle> findByFleetOwnerId(java.util.UUID fleetOwnerId);
}
