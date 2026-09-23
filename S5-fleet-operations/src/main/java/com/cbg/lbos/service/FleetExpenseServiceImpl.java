package com.cbg.lbos.service;

import com.cbg.lbos.dto.*;
import com.cbg.lbos.entity.*;
import com.cbg.lbos.repository.*;
import com.cbg.lbos.client.S2PartnerClient;
import com.cbg.lbos.exception.BadRequestException;
import com.cbg.lbos.exception.ConflictException;
import com.cbg.lbos.exception.ResourceNotFoundException;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.*;
import java.time.*;

@Service
public class FleetExpenseServiceImpl implements FleetExpenseService {
	private final FleetExpenseRepository expenseRepository;
	private final S2PartnerClient partnerClient;

	public FleetExpenseServiceImpl(FleetExpenseRepository expenseRepository, S2PartnerClient partnerClient) {
		this.expenseRepository = expenseRepository;
		this.partnerClient = partnerClient;
	}

	@Transactional
	public FleetExpenseDto create(FleetExpenseDto expenseDto, UUID createdByAccountId) {
		FleetOwnerValidationDto ownerValidation = partnerClient.validateFleetOwner(expenseDto.getFleetOwnerId());
		/*
		 * Was checking getProfileStatus() (S2's KYC/verification outcome - VERIFIED/PENDING),
		 * not getOwnerStatus() (the account's active/suspended state) - since S2 seeds
		 * profileStatus=VERIFIED for the only fleet owner in the demo, this rejected every
		 * expense with "Fleet owner inactive in S2" even though the owner was active. Confirmed
		 * live: S2's /internal/v1/fleet-owners/{id}/validation actually returns
		 * profileStatus=VERIFIED, ownerStatus=ACTIVE for fleetowner1.
		 */
		if (!"ACTIVE".equalsIgnoreCase(ownerValidation.getOwnerStatus()))
			throw new BadRequestException("Fleet owner inactive in S2");
		if (expenseDto.getAmount() == null || expenseDto.getAmount().signum() <= 0
				|| expenseDto.getExpenseDate() == null || expenseDto.getExpenseDate().isAfter(LocalDate.now()))
			throw new BadRequestException("Invalid expense");
		if (expenseDto.getAmount().compareTo(new java.math.BigDecimal("10000")) > 0)
			throw new BadRequestException("A single expense cannot exceed ₹10,000");
		FleetExpense expense = new FleetExpense();
		BeanUtils.copyProperties(expenseDto, expense);
		expense.setApprovalStatus(ExpenseApprovalStatus.PENDING);
		/*
		 * Was left as whatever createdByAccountId the client's DTO happened to carry
		 * (null on a normal create, since nothing ever populated it - or anything a caller
		 * chose to send). approve()'s self-approval guard compares approver.equals(
		 * getCreatedByAccountId()), and approver is always a real JWT-derived UUID, so a
		 * permanently-null createdByAccountId meant that guard could never fire for any
		 * expense created through the normal API - confirmed live. Now pinned server-side
		 * from the authenticated caller, the same way approve()/reject() already derive
		 * their own actor id, instead of trusting BeanUtils.copyProperties on this field.
		 */
		expense.setCreatedByAccountId(createdByAccountId);
		return map(expenseRepository.save(expense));
	}

	@Transactional(readOnly = true)
	public FleetExpenseDto get(UUID id) {
		return map(find(id));
	}

	@Transactional(readOnly = true)
	public List<FleetExpenseDto> getAll() {
		return list(expenseRepository.findAll());
	}

	@Transactional(readOnly = true)
	public List<FleetExpenseDto> getByFleetOwner(UUID fleetOwnerId) {
		return list(expenseRepository.findByFleetOwnerId(fleetOwnerId));
	}

	@Transactional
	public FleetExpenseDto approve(UUID id, UUID approver) {
		FleetExpense expense = find(id);
		if (expense.getApprovalStatus() != ExpenseApprovalStatus.PENDING
				|| approver.equals(expense.getCreatedByAccountId()))
			throw new ConflictException("Cannot approve");
		expense.setApprovalStatus(ExpenseApprovalStatus.APPROVED);
		expense.setApprovedByAccountId(approver);
		return map(expenseRepository.save(expense));
	}

	@Transactional
	public FleetExpenseDto reject(UUID id, UUID approver) {
		FleetExpense expense = find(id);
		if (expense.getApprovalStatus() == ExpenseApprovalStatus.REJECTED)
			throw new ConflictException("Expense is already rejected");
		// APPROVED is intentionally reversible so a fleet manager can correct an accidental
		// reimbursement click. No separate PAID state exists in this project's expense model.
		expense.setApprovalStatus(ExpenseApprovalStatus.REJECTED);
		expense.setApprovedByAccountId(approver);
		return map(expenseRepository.save(expense));
	}

	@Transactional
	public void delete(UUID id) {
		expenseRepository.delete(find(id));
	}

	private static final Set<String> ALLOWED_PROOF_CONTENT_TYPES = Set.of(
			"application/pdf", "image/jpeg", "image/png");
	private static final long MAX_PROOF_FILE_SIZE_BYTES = 10 * 1024 * 1024;

	@Transactional
	public FleetExpenseDto uploadProof(UUID id, MultipartFile file, UUID uploadedByAccountId) {
		if (file == null || file.isEmpty())
			throw new BadRequestException("Uploaded file is empty");
		if (file.getSize() > MAX_PROOF_FILE_SIZE_BYTES)
			throw new BadRequestException("Uploaded file exceeds the maximum allowed size of 10MB");
		String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
		if (!ALLOWED_PROOF_CONTENT_TYPES.contains(contentType))
			throw new BadRequestException("Unsupported file type '" + contentType + "'. Allowed: PDF, JPG, PNG");

		FleetExpense expense = find(id);
		try {
			expense.setProofFileContent(file.getBytes());
		} catch (IOException e) {
			throw new UncheckedIOException("Failed to read uploaded proof file", e);
		}
		expense.setProofFileName(file.getOriginalFilename());
		expense.setProofContentType(contentType);
		expense.setAttachmentUploadedByAccountId(uploadedByAccountId);
		return map(expenseRepository.save(expense));
	}

	@Transactional(readOnly = true)
	public Optional<ProofFile> getProofFile(UUID id) {
		FleetExpense expense = find(id);
		if (expense.getProofFileContent() == null || expense.getProofFileContent().length == 0)
			return Optional.empty();
		return Optional.of(new ProofFile(expense.getProofFileContent(), expense.getProofFileName(), expense.getProofContentType()));
	}

	private FleetExpense find(UUID id) {
		return expenseRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Expense not found"));
	}

	private FleetExpenseDto map(FleetExpense expense) {
		FleetExpenseDto expenseDto = new FleetExpenseDto();
		BeanUtils.copyProperties(expense, expenseDto);
		expenseDto.setHasProof(expense.getProofFileContent() != null && expense.getProofFileContent().length > 0);
		return expenseDto;
	}

	private List<FleetExpenseDto> list(List<FleetExpense> expenses) {
		List<FleetExpenseDto> expenseDtos = new ArrayList<>();
		for (FleetExpense expense : expenses)
			expenseDtos.add(map(expense));
		return expenseDtos;
	}
}
