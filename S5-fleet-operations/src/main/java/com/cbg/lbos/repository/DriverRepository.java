package com.cbg.lbos.repository;

import com.cbg.lbos.entity.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface DriverRepository extends JpaRepository<Driver, UUID> {
	boolean existsByLicenseNumber(String licenseNumber);

	boolean existsByUserAccountId(UUID userAccountId);

	List<Driver> findByDriverStatus(DriverStatus driverStatus);

	List<Driver> findByFleetOwnerIdAndDriverStatus(UUID fleetOwnerId, DriverStatus driverStatus);

	Optional<Driver> findByUserAccountId(UUID userAccountId);

	/** Backs GET /api/drivers/mine - a fleet owner's own drivers, regardless of status. */
	List<Driver> findByFleetOwnerId(UUID fleetOwnerId);
}

