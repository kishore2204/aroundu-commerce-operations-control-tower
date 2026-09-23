package com.cbg.lbos.service;

import com.cbg.lbos.dto.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.*;

public interface FleetExpenseService {
	FleetExpenseDto create(FleetExpenseDto expenseDto, UUID createdByAccountId);

	FleetExpenseDto get(UUID id);

	List<FleetExpenseDto> getAll();

	List<FleetExpenseDto> getByFleetOwner(UUID fleetOwnerId);

	FleetExpenseDto approve(UUID id, UUID approver);

	FleetExpenseDto reject(UUID id, UUID approver);

	void delete(UUID id);

	/** Uploads/replaces this expense's proof-of-expense file (receipt photo/PDF). */
	FleetExpenseDto uploadProof(UUID id, MultipartFile file, UUID uploadedByAccountId);

	/** The stored proof file's bytes plus its name/content-type, or empty if none uploaded. */
	Optional<ProofFile> getProofFile(UUID id);

	record ProofFile(byte[] content, String fileName, String contentType) {
	}
}
