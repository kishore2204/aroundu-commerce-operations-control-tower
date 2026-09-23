package com.cbg.lbos.dto;

import com.cbg.lbos.client.dto.DriverSummary;
import com.cbg.lbos.client.dto.FleetOwnerSummary;
import com.cbg.lbos.client.dto.VehicleSummary;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public class TripDto {

    private UUID id;
    private Long orderId;
    private UUID vehicleId;
    private UUID driverId;
    private UUID fleetOwnerId;
    private UUID createdByAccountId;
    private UUID assignedByAccountId;
    private String tripNumber;
    private String tripStatus;
    private OffsetDateTime plannedStartAt;
    private OffsetDateTime actualStartAt;
    private OffsetDateTime completedAt;
    private BigDecimal distanceKm;
    private String proofOfPickup;
    private String proofOfDelivery;

    /*
     * Read-only enrichment, fetched live via Feign at toDto() time (see
     * TripService.toDto()) - never client-writable input, and never persisted.
     * fleetOwner may be null if the lookup fails or fleetOwnerId is unset.
     */
    private DriverSummary driver;
    private VehicleSummary vehicle;
    private FleetOwnerSummary fleetOwner;

    /*
     * Earnings-clarity enrichment, also computed fresh at toDto() time - never persisted.
     * orderDeliveryCharge mirrors Order.deliveryCharge; driverEarning is only populated once the
     * trip is COMPLETED (earnings realize on delivery, matching the escrow split's own posture)
     * and only when the driver has a commissionPercent on file, else null rather than a
     * misleadingly-defaulted number.
     */
    private BigDecimal orderDeliveryCharge;
    private BigDecimal driverEarning;
    private String pickupAddress;
    private String dropAddress;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Long getOrderId() {
        return orderId;
    }

    public void setOrderId(Long orderId) {
        this.orderId = orderId;
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

    public DriverSummary getDriver() {
        return driver;
    }

    public void setDriver(DriverSummary driver) {
        this.driver = driver;
    }

    public VehicleSummary getVehicle() {
        return vehicle;
    }

    public void setVehicle(VehicleSummary vehicle) {
        this.vehicle = vehicle;
    }

    public FleetOwnerSummary getFleetOwner() {
        return fleetOwner;
    }

    public void setFleetOwner(FleetOwnerSummary fleetOwner) {
        this.fleetOwner = fleetOwner;
    }

    public BigDecimal getOrderDeliveryCharge() {
        return orderDeliveryCharge;
    }

    public void setOrderDeliveryCharge(BigDecimal orderDeliveryCharge) {
        this.orderDeliveryCharge = orderDeliveryCharge;
    }

    public BigDecimal getDriverEarning() {
        return driverEarning;
    }

    public void setDriverEarning(BigDecimal driverEarning) {
        this.driverEarning = driverEarning;
    }

    public String getPickupAddress() {
        return pickupAddress;
    }

    public void setPickupAddress(String pickupAddress) {
        this.pickupAddress = pickupAddress;
    }

    public String getDropAddress() {
        return dropAddress;
    }

    public void setDropAddress(String dropAddress) {
        this.dropAddress = dropAddress;
    }
}
