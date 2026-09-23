package com.example.lbos.service;

import com.example.lbos.dto.FleetOwnerDTO;
import java.util.List;
import java.util.UUID;

public interface FleetOwnerService {
    FleetOwnerDTO createFleetOwner(FleetOwnerDTO dto);
    FleetOwnerDTO getFleetOwnerById(UUID id);
    FleetOwnerDTO getFleetOwnerByUserAccountId(UUID userAccountId);
    List<FleetOwnerDTO> getAllFleetOwners();
    FleetOwnerDTO updateFleetOwner(UUID id, FleetOwnerDTO dto);
    void deleteFleetOwner(UUID id);
    List<FleetOwnerDTO> getFleetOwnersByCityId(UUID cityId);
    List<FleetOwnerDTO> getFleetOwnersByStatus(String status);
    List<FleetOwnerDTO> getFleetOwnersByProfileStatus(String profileStatus);
    List<FleetOwnerDTO> searchFleetOwnersByBusinessName(String businessName);

    // Business Workflow
    FleetOwnerDTO registerFleetOwner(FleetOwnerDTO dto);

    /** Returns the verification queue id the documents were attached to, so the caller can
     *  immediately follow up with real file uploads against it (POST
     *  /api/verification-documents/upload) - this metadata-only call alone never stores real
     *  file bytes, see VerificationDocumentServiceImpl.uploadVerificationDocument for that. */
    UUID submitFleetOwnerDocuments(UUID id, List<com.example.lbos.dto.VerificationDocumentDTO> documents);
    void submitFleetOwnerForVerification(UUID id);
    String getFleetOwnerVerificationStatus(UUID id);

    /** The most recent rejection reason recorded for this fleet owner, or null if never rejected. */
    String getFleetOwnerVerificationRejectionReason(UUID id);

    /** Controller support for resubmission UI; does not alter persistence. */
    java.util.Optional<com.example.lbos.dto.VerificationQueueDTO> getActiveVerificationQueueForSubjectForController(java.util.UUID subjectId);
    String getRejectedCurrentDocumentTypesForController(java.util.UUID verificationQueueId);
}
