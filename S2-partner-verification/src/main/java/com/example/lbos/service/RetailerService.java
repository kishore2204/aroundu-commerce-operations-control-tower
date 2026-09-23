package com.example.lbos.service;

import com.example.lbos.dto.RetailerDTO;
import java.util.List;
import java.util.UUID;

public interface RetailerService {
    RetailerDTO createRetailer(RetailerDTO retailerDTO);
    RetailerDTO getRetailerById(UUID retailerId);
    RetailerDTO getRetailerByUserAccountId(UUID userAccountId);
    List<RetailerDTO> getAllRetailers();
    RetailerDTO updateRetailer(UUID retailerId, RetailerDTO retailerDTO);
    void deleteRetailer(UUID retailerId);
    List<RetailerDTO> getRetailersByCity(UUID cityId);
    List<RetailerDTO> getRetailersByStatus(String status);
    /** VERIFIED retailers active in this zone - backs the customer-facing zone-based catalogue
     *  filter (see InternalRetailerController). */
    List<RetailerDTO> getVerifiedRetailersByZone(UUID zoneId);

    /** Retailer ids that are open for orders right now (isOpen=true and, if store hours are
     *  set, the current time falls within them) - backs the customer-facing catalogue's
     *  "only show products from currently-open stores" filter. A retailer with no opensAt/
     *  closesAt set is treated as always-open (no hours configured yet, not "closed"). */
    List<UUID> getOpenRetailerIds();
    List<RetailerDTO> searchRetailers(String businessName);

    // Business Workflow
    RetailerDTO registerRetailer(RetailerDTO retailerDTO);

    /** Returns the verification queue id the documents were attached to, so the caller can
     *  immediately follow up with real file uploads against it (POST
     *  /api/verification-documents/upload) - this metadata-only call alone never stores real
     *  file bytes, see VerificationDocumentServiceImpl.uploadVerificationDocument for that. */
    UUID submitRetailerDocuments(UUID retailerId, List<com.example.lbos.dto.VerificationDocumentDTO> documents);
    void submitRetailerForVerification(UUID retailerId);
    String getRetailerVerificationStatus(UUID retailerId);

    /** The most recent rejection reason recorded for this retailer, or null if never rejected. */
    String getRetailerVerificationRejectionReason(UUID retailerId);

    /** Controller support for resubmission UI; does not alter persistence. */
    java.util.Optional<com.example.lbos.dto.VerificationQueueDTO> getActiveVerificationQueueForSubjectForController(java.util.UUID subjectId);
    String getRejectedCurrentDocumentTypesForController(java.util.UUID verificationQueueId);
}
