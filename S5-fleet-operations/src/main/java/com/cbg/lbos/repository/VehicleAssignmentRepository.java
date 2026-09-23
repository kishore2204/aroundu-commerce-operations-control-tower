package com.cbg.lbos.repository;

import com.cbg.lbos.entity.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface VehicleAssignmentRepository extends JpaRepository<VehicleAssignment, UUID> {
	boolean existsByVehicleIdAndAssignmentStatus(UUID vehicleId, AssignmentStatus assignmentStatus);

	boolean existsByDriverIdAndAssignmentStatus(UUID driverId, AssignmentStatus assignmentStatus);

	List<VehicleAssignment> findByAssignmentStatus(AssignmentStatus assignmentStatus);

	List<VehicleAssignment> findByVehicleIdAndAssignmentStatus(UUID vehicleId, AssignmentStatus assignmentStatus);

	List<VehicleAssignment> findByDriverIdAndAssignmentStatus(UUID driverId, AssignmentStatus assignmentStatus);

	/** Backs GET /api/assignments/mine - assignments for any of a fleet owner's own vehicles. */
	List<VehicleAssignment> findByVehicleIdIn(List<UUID> vehicleIds);

	/** All-time assignment count for a vehicle/driver - the "load" metric the rebalance feature ranks by. */
	long countByVehicleId(UUID vehicleId);

	long countByDriverId(UUID driverId);
}
