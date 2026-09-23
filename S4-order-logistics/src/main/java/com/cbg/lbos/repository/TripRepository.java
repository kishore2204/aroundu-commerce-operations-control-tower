package com.cbg.lbos.repository;

import com.cbg.lbos.entity.Trip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TripRepository
        extends JpaRepository<Trip, UUID> {

    Optional<Trip> findByOrder_Id(Long orderId);

    /** Backs GET /api/trips/mine - a fleet owner's own trips. */
    java.util.List<Trip> findByFleetOwnerId(UUID fleetOwnerId);

    java.util.List<Trip> findByDriverId(UUID driverId);


    boolean existsByTripNumber(String tripNumber);

    boolean existsByTripNumberAndIdNot(
            String tripNumber,
            UUID tripId
    );

    boolean existsByOrder_Id(Long orderId);

    boolean existsByVehicleIdAndTripStatusIn(
            UUID vehicleId,
            Collection<String> tripStatuses
    );

    boolean existsByVehicleIdAndTripStatusInAndIdNot(
            UUID vehicleId,
            Collection<String> tripStatuses,
            UUID tripId
    );

    boolean existsByDriverIdAndTripStatusIn(
            UUID driverId,
            Collection<String> tripStatuses
    );

    boolean existsByDriverIdAndTripStatusInAndIdNot(
            UUID driverId,
            Collection<String> tripStatuses,
            UUID tripId
    );
}