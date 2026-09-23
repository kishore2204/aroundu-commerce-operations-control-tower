package com.cbg.lbos.dto;

import com.cbg.lbos.entity.*;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;

public class VehicleAssignmentDto {
	UUID vehicleAssignmentId;
	UUID vehicleId;
	UUID driverId;
	UUID assignedByAccountId;
	AssignmentStatus assignmentStatus;
	LocalDateTime assignedAt;
	LocalDateTime endedAt;
	BigDecimal cargoWeightKg;
	String requiredVehicleType;

	public VehicleAssignmentDto() {
	}

	public UUID getVehicleAssignmentId() {
		return vehicleAssignmentId;
	}

	public void setVehicleAssignmentId(UUID vehicleAssignmentId) {
		this.vehicleAssignmentId = vehicleAssignmentId;
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

	public UUID getAssignedByAccountId() {
		return assignedByAccountId;
	}

	public void setAssignedByAccountId(UUID assignedByAccountId) {
		this.assignedByAccountId = assignedByAccountId;
	}

	public AssignmentStatus getAssignmentStatus() {
		return assignmentStatus;
	}

	public void setAssignmentStatus(AssignmentStatus assignmentStatus) {
		this.assignmentStatus = assignmentStatus;
	}

	public LocalDateTime getAssignedAt() {
		return assignedAt;
	}

	public void setAssignedAt(LocalDateTime assignedAt) {
		this.assignedAt = assignedAt;
	}

	public LocalDateTime getEndedAt() {
		return endedAt;
	}

	public void setEndedAt(LocalDateTime endedAt) {
		this.endedAt = endedAt;
	}

	public BigDecimal getCargoWeightKg() {
		return cargoWeightKg;
	}

	public void setCargoWeightKg(BigDecimal cargoWeightKg) {
		this.cargoWeightKg = cargoWeightKg;
	}

	public String getRequiredVehicleType() {
		return requiredVehicleType;
	}

	public void setRequiredVehicleType(String requiredVehicleType) {
		this.requiredVehicleType = requiredVehicleType;
	}
}