package com.cbg.lbos.dto;

import com.cbg.lbos.entity.*;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;

public class FleetExpenseDto {
	UUID fleetExpenseId;
	UUID fleetOwnerId;
	UUID vehicleId;
	UUID driverId;
	UUID createdByAccountId;
	UUID approvedByAccountId;
	UUID attachmentUploadedByAccountId;
	ExpenseType expenseType;
	BigDecimal amount;
	LocalDate expenseDate;
	ExpenseApprovalStatus approvalStatus;
	/* Whether a proof file has been uploaded, and its name - never the raw bytes, same
	 * "metadata in the list DTO, bytes behind a separate endpoint" split S2's
	 * VerificationDocumentDTO uses. */
	boolean hasProof;
	String proofFileName;

	public FleetExpenseDto() {
	}

	public UUID getFleetExpenseId() {
		return fleetExpenseId;
	}

	public void setFleetExpenseId(UUID fleetExpenseId) {
		this.fleetExpenseId = fleetExpenseId;
	}

	public UUID getFleetOwnerId() {
		return fleetOwnerId;
	}

	public void setFleetOwnerId(UUID fleetOwnerId) {
		this.fleetOwnerId = fleetOwnerId;
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

	public UUID getCreatedByAccountId() {
		return createdByAccountId;
	}

	public void setCreatedByAccountId(UUID createdByAccountId) {
		this.createdByAccountId = createdByAccountId;
	}

	public UUID getApprovedByAccountId() {
		return approvedByAccountId;
	}

	public void setApprovedByAccountId(UUID approvedByAccountId) {
		this.approvedByAccountId = approvedByAccountId;
	}

	public UUID getAttachmentUploadedByAccountId() {
		return attachmentUploadedByAccountId;
	}

	public void setAttachmentUploadedByAccountId(UUID attachmentUploadedByAccountId) {
		this.attachmentUploadedByAccountId = attachmentUploadedByAccountId;
	}

	public ExpenseType getExpenseType() {
		return expenseType;
	}

	public void setExpenseType(ExpenseType expenseType) {
		this.expenseType = expenseType;
	}

	public BigDecimal getAmount() {
		return amount;
	}

	public void setAmount(BigDecimal amount) {
		this.amount = amount;
	}

	public LocalDate getExpenseDate() {
		return expenseDate;
	}

	public void setExpenseDate(LocalDate expenseDate) {
		this.expenseDate = expenseDate;
	}

	public ExpenseApprovalStatus getApprovalStatus() {
		return approvalStatus;
	}

	public void setApprovalStatus(ExpenseApprovalStatus approvalStatus) {
		this.approvalStatus = approvalStatus;
	}

	public boolean isHasProof() {
		return hasProof;
	}

	public void setHasProof(boolean hasProof) {
		this.hasProof = hasProof;
	}

	public String getProofFileName() {
		return proofFileName;
	}

	public void setProofFileName(String proofFileName) {
		this.proofFileName = proofFileName;
	}
}