package com.cbg.lbos.controller;

import com.cbg.lbos.client.S2PartnerClient;
import com.cbg.lbos.dto.*;
import com.cbg.lbos.entity.*;
import com.cbg.lbos.service.*;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.*;

@RestController
@RequestMapping("/api/expenses")
public class FleetExpenseController {
	private final FleetExpenseService expenseService;

	private final S2PartnerClient partnerClient;

	public FleetExpenseController(FleetExpenseService expenseService, S2PartnerClient partnerClient) {
		this.expenseService = expenseService;
		this.partnerClient = partnerClient;
	}

	@PostMapping
	public FleetExpenseDto create(@RequestBody FleetExpenseDto expenseDto, Authentication authentication) {
		if (expenseDto.getFleetOwnerId() == null && authentication != null && authentication.getName() != null) {
			try {
				UUID userAccountId = UUID.fromString(authentication.getName());
				FleetOwnerValidationDto validation = partnerClient.getFleetOwnerByUserAccountId(userAccountId);
				if (validation != null) {
					expenseDto.setFleetOwnerId(validation.getFleetOwnerId());
				}
			} catch (Exception ignored) {
			}
		}
		return expenseService.create(expenseDto, resolveAuthenticatedUserAccountId(authentication));
	}

	@GetMapping("/{id}")
	public FleetExpenseDto get(@PathVariable UUID id) {
		return expenseService.get(id);
	}

	@GetMapping
	public List<FleetExpenseDto> all(@RequestParam(required = false) UUID fleetOwnerId) {
		return fleetOwnerId == null ? expenseService.getAll() : expenseService.getByFleetOwner(fleetOwnerId);
	}

	/** Fleet-owner-facing: this fleet owner's own expenses. */
	@GetMapping("/mine")
	public List<FleetExpenseDto> mine(
			@RequestParam(required = false) UUID fleetOwnerId,
			Authentication authentication) {
		UUID targetId = fleetOwnerId;
		if (targetId == null && authentication != null && authentication.getName() != null) {
			try {
				UUID userAccountId = UUID.fromString(authentication.getName());
				FleetOwnerValidationDto validation = partnerClient.getFleetOwnerByUserAccountId(userAccountId);
				if (validation != null) {
					targetId = validation.getFleetOwnerId();
				}
			} catch (Exception ignored) {
			}
		}
		if (targetId == null) {
			return Collections.emptyList();
		}
		return expenseService.getByFleetOwner(targetId);
	}


	@DeleteMapping("/{id}")
	public void delete(@PathVariable UUID id) {
		expenseService.delete(id);
	}

	/*
	 * approverId used to come straight from a query param - anyone could approve/reject any
	 * expense while claiming to be any approver, including bypassing the service's own
	 * self-approval check by simply naming someone else's account. It's now always the
	 * authenticated caller.
	 */
	@PatchMapping("/{id}/approve")
	public FleetExpenseDto approve(@PathVariable UUID id, Authentication authentication) {
		return expenseService.approve(id, resolveAuthenticatedUserAccountId(authentication));
	}

	@PatchMapping("/{id}/reject")
	public FleetExpenseDto reject(@PathVariable UUID id, Authentication authentication) {
		return expenseService.reject(id, resolveAuthenticatedUserAccountId(authentication));
	}

	/** Uploads/replaces this expense's proof file (receipt photo/PDF, max 10MB) - the driver
	 *  who incurred it or a fleet manager can call this. */
	@PostMapping(value = "/{id}/proof", consumes = "multipart/form-data")
	public FleetExpenseDto uploadProof(
			@PathVariable UUID id,
			@RequestParam("file") MultipartFile file,
			Authentication authentication) {
		return expenseService.uploadProof(id, file, resolveAuthenticatedUserAccountId(authentication));
	}

	@GetMapping("/{id}/proof")
	public ResponseEntity<byte[]> downloadProof(@PathVariable UUID id) {
		FleetExpenseService.ProofFile file = expenseService.getProofFile(id)
				.orElseThrow(() -> new com.cbg.lbos.exception.ResourceNotFoundException(
						"No proof file uploaded for expense " + id));

		MediaType mediaType;
		try {
			mediaType = MediaType.parseMediaType(file.contentType());
		} catch (Exception e) {
			mediaType = MediaType.APPLICATION_OCTET_STREAM;
		}
		String fileName = file.fileName() == null ? "proof" : file.fileName();
		ContentDisposition disposition = ContentDisposition.attachment().filename(fileName).build();

		return ResponseEntity.ok()
				.contentType(mediaType)
				.header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
				.body(file.content());
	}

	private UUID resolveAuthenticatedUserAccountId(Authentication authentication) {
		if (authentication == null || authentication.getName() == null) {
			throw new IllegalStateException("No authenticated user on this request");
		}
		try {
			return UUID.fromString(authentication.getName());
		} catch (IllegalArgumentException invalidSubjectException) {
			throw new IllegalStateException("Authenticated subject is not a valid user account id");
		}
	}
}
