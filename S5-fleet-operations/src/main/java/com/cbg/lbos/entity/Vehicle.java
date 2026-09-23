package com.cbg.lbos.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;

/** Indexed on fleet_owner_id - the FK behind VehicleRepository.findByFleetOwnerId(), used to
 *  render one fleet owner's vehicle list/count without a full table scan. */
@Entity
@Table(name = "vehicle", indexes = @Index(name = "idx_vehicle_fleet_owner_id", columnList = "fleet_owner_id"))
public class Vehicle {
	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID vehicleId;
	private UUID fleetOwnerId;
	private UUID updatedByAccountId;
	@Column(nullable = false, unique = true)
	private String registrationNumber;
	@Column(nullable = false)
	private String vehicleType;
	private String make;
	private String model;
	private Integer modelYear;
	private BigDecimal capacityKg;
	@Enumerated(EnumType.STRING)
	private VehicleStatus vehicleStatus = VehicleStatus.ACTIVE;
	/*
	 * Nullable - most existing/seeded rows have no location yet. Used by
	 * VehicleServiceImpl.nearestAvailable() (haversine distance) to find the nearest available
	 * vehicle to a delivery address once a retailer accepts a retail order - see S4's
	 * OrderService.retailerAccept(). Not required at vehicle creation time.
	 */
	private BigDecimal latitude;
	private BigDecimal longitude;

	public Vehicle() {
	}

	public UUID getVehicleId() {
		return vehicleId;
	}

	public void setVehicleId(UUID vehicleId) {
		this.vehicleId = vehicleId;
	}

	public UUID getFleetOwnerId() {
		return fleetOwnerId;
	}

	public void setFleetOwnerId(UUID fleetOwnerId) {
		this.fleetOwnerId = fleetOwnerId;
	}

	public UUID getUpdatedByAccountId() {
		return updatedByAccountId;
	}

	public void setUpdatedByAccountId(UUID updatedByAccountId) {
		this.updatedByAccountId = updatedByAccountId;
	}

	public String getRegistrationNumber() {
		return registrationNumber;
	}

	public void setRegistrationNumber(String registrationNumber) {
		this.registrationNumber = registrationNumber;
	}

	public String getVehicleType() {
		return vehicleType;
	}

	public void setVehicleType(String vehicleType) {
		this.vehicleType = vehicleType;
	}

	public String getMake() {
		return make;
	}

	public void setMake(String make) {
		this.make = make;
	}

	public String getModel() {
		return model;
	}

	public void setModel(String model) {
		this.model = model;
	}

	public Integer getModelYear() {
		return modelYear;
	}

	public void setModelYear(Integer modelYear) {
		this.modelYear = modelYear;
	}

	public BigDecimal getCapacityKg() {
		return capacityKg;
	}

	public void setCapacityKg(BigDecimal capacityKg) {
		this.capacityKg = capacityKg;
	}

	public VehicleStatus getVehicleStatus() {
		return vehicleStatus;
	}

	public void setVehicleStatus(VehicleStatus vehicleStatus) {
		this.vehicleStatus = vehicleStatus;
	}

	public BigDecimal getLatitude() {
		return latitude;
	}

	public void setLatitude(BigDecimal latitude) {
		this.latitude = latitude;
	}

	public BigDecimal getLongitude() {
		return longitude;
	}

	public void setLongitude(BigDecimal longitude) {
		this.longitude = longitude;
	}
}
