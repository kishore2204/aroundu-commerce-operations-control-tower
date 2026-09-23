package com.cbg.lbos.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "vehicle_assignment")
public class VehicleAssignment {
	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID vehicleAssignmentId;
	private UUID vehicleId;
	private UUID driverId;
	private UUID assignedByAccountId;
	@Enumerated(EnumType.STRING)
	private AssignmentStatus assignmentStatus = AssignmentStatus.ACTIVE;
	private LocalDateTime assignedAt;
	private LocalDateTime endedAt;
	private BigDecimal cargoWeightKg;
	private String requiredVehicleType;

	public VehicleAssignment() {
	}

	@PrePersist
	public void initialize() {
		if (assignedAt == null)
			assignedAt = LocalDateTime.now();
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
