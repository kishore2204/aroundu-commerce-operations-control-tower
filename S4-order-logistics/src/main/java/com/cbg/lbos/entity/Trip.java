package com.cbg.lbos.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Indexed on the columns findByFleetOwnerId/findByDriverId and the vehicle/driver availability
 *  checks (existsByVehicleIdAndTripStatusIn*, existsByDriverIdAndTripStatusIn*, run on every trip
 *  create/update) actually filter on - none of these had an index before. */
@Entity
@Table(name = "trip", indexes = {
        @Index(name = "idx_trip_fleet_owner_id", columnList = "fleet_owner_id"),
        @Index(name = "idx_trip_driver_id", columnList = "driver_id"),
        @Index(name = "idx_trip_vehicle_id_status", columnList = "vehicle_id, trip_status"),
})
public class Trip {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "trip_id", updatable = false, nullable = false)
    private UUID id;
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false, unique = true)
    private Order order;
    /*
     * vehicle and driver are owned by S5 (lbos-fleet), fleet_owner by S2 and
     * user_account by S1 (lbos-platform). All are stored as plain scalar FKs,
     * never JPA relationships to another service's table.
     */
    @Column(name = "vehicle_id", nullable = false)
    private UUID vehicleId;
    @Column(name = "driver_id", nullable = false)
    private UUID driverId;
    @Column(name = "fleet_owner_id", nullable = false)
    private UUID fleetOwnerId;
    @Column(name = "created_by_account_id", nullable = false)
    private UUID createdByAccountId;
    @Column(name = "assigned_by_account_id")
    private UUID assignedByAccountId;
    @Column(name = "trip_number", nullable = false)
    private String tripNumber;
    @Column(name = "trip_status", nullable = false)
    private String tripStatus;
    @Column(name = "planned_start_at")
    private OffsetDateTime plannedStartAt;
    @Column(name = "actual_start_at")
    private OffsetDateTime actualStartAt;
    @Column(name = "completed_at")
    private OffsetDateTime completedAt;
    @Column(name = "distance_km", precision = 10, scale = 2)
    private BigDecimal distanceKm;
    @Column(name = "proof_of_pickup", columnDefinition = "text")
    private String proofOfPickup;
    @Column(name = "proof_of_delivery", columnDefinition = "text")
    private String proofOfDelivery;

    public Trip() {
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Order getOrder() {
        return order;
    }

    public void setOrder(Order order) {
        this.order = order;
    }

    public UUID getVehicleId() {
        return vehicleId;
    }

    public void setVehicleId(UUID vehicleId) {
        this.vehicleId = vehicleId;
    }

    public UUID getDriverId() {
        return driverId;
    }

    public void setDriverId(UUID driverId) {
        this.driverId = driverId;
    }

    public UUID getFleetOwnerId() {
        return fleetOwnerId;
    }

    public void setFleetOwnerId(UUID fleetOwnerId) {
        this.fleetOwnerId = fleetOwnerId;
    }

    public UUID getCreatedByAccountId() {
        return createdByAccountId;
    }

    public void setCreatedByAccountId(UUID createdByAccountId) {
        this.createdByAccountId = createdByAccountId;
    }

    public UUID getAssignedByAccountId() {
        return assignedByAccountId;
    }

    public void setAssignedByAccountId(UUID assignedByAccountId) {
        this.assignedByAccountId = assignedByAccountId;
    }

    public String getTripNumber() {
        return tripNumber;
    }

    public void setTripNumber(String tripNumber) {
        this.tripNumber = tripNumber;
    }

    public String getTripStatus() {
        return tripStatus;
    }

    public void setTripStatus(String tripStatus) {
        this.tripStatus = tripStatus;
    }

    public OffsetDateTime getPlannedStartAt() {
        return plannedStartAt;
    }

    public void setPlannedStartAt(OffsetDateTime plannedStartAt) {
        this.plannedStartAt = plannedStartAt;
    }

    public OffsetDateTime getActualStartAt() {
        return actualStartAt;
    }

    public void setActualStartAt(OffsetDateTime actualStartAt) {
        this.actualStartAt = actualStartAt;
    }

    public OffsetDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(OffsetDateTime completedAt) {
        this.completedAt = completedAt;
    }

    public BigDecimal getDistanceKm() {
        return distanceKm;
    }

    public void setDistanceKm(BigDecimal distanceKm) {
        this.distanceKm = distanceKm;
    }

    public String getProofOfPickup() {
        return proofOfPickup;
    }

    public void setProofOfPickup(String proofOfPickup) {
        this.proofOfPickup = proofOfPickup;
    }

    public String getProofOfDelivery() {
        return proofOfDelivery;
    }

    public void setProofOfDelivery(String proofOfDelivery) {
        this.proofOfDelivery = proofOfDelivery;
    }

}
