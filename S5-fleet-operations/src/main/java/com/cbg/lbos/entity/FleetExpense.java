package com.cbg.lbos.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "fleet_expense")
public class FleetExpense {
	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID fleetExpenseId;
	private UUID fleetOwnerId;
	private UUID vehicleId;
	private UUID driverId;
	private UUID createdByAccountId;
	private UUID approvedByAccountId;
	private UUID attachmentUploadedByAccountId;
	@Enumerated(EnumType.STRING)
	private ExpenseType expenseType;
	private BigDecimal amount;
	private LocalDate expenseDate;
	@Enumerated(EnumType.STRING)
	private ExpenseApprovalStatus approvalStatus = ExpenseApprovalStatus.PENDING;

	/* Proof-of-expense file (receipt photo/PDF) - same VARBINARY approach as
	 * S2 VerificationDocument.fileContent (plain @Lob maps to Postgres's oid large-object
	 * type, not a real bytea column). */
	@JdbcTypeCode(SqlTypes.VARBINARY)
	@Column(name = "proof_file_content")
	private byte[] proofFileContent;
	@Column(name = "proof_file_name", length = 255)
	private String proofFileName;
	@Column(name = "proof_content_type", length = 100)
	private String proofContentType;

	public FleetExpense() {
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

	public byte[] getProofFileContent() {
		return proofFileContent;
	}

	public void setProofFileContent(byte[] proofFileContent) {
		this.proofFileContent = proofFileContent;
	}

	public String getProofFileName() {
		return proofFileName;
	}

	public void setProofFileName(String proofFileName) {
		this.proofFileName = proofFileName;
	}

	public String getProofContentType() {
		return proofContentType;
	}

	public void setProofContentType(String proofContentType) {
		this.proofContentType = proofContentType;
	}
}
