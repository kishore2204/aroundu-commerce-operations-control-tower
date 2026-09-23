package com.cbg.lbos.dto;

import com.cbg.lbos.entity.*;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;

public class VehicleDto {
	UUID vehicleId;
	UUID fleetOwnerId;
	UUID updatedByAccountId;
	String registrationNumber;
	String vehicleType;
	String make;
	String model;
	Integer modelYear;
	BigDecimal capacityKg;
	VehicleStatus vehicleStatus;
	BigDecimal latitude;
	BigDecimal longitude;

	public VehicleDto() {
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