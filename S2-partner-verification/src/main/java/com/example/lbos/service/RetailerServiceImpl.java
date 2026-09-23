package com.example.lbos.service;

import com.example.lbos.repository.RetailerRepository;
import com.example.lbos.dto.RetailerDTO;
import com.example.lbos.entity.Retailer;
import com.example.lbos.exception.RetailerNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class RetailerServiceImpl implements RetailerService {

    private final RetailerRepository retailerRepository;
    private final com.example.lbos.service.VerificationQueueService verificationQueueService;
    private final com.example.lbos.service.VerificationDocumentService verificationDocumentService;

    public RetailerServiceImpl(RetailerRepository retailerRepository,
                               com.example.lbos.service.VerificationQueueService verificationQueueService,
                               com.example.lbos.service.VerificationDocumentService verificationDocumentService) {
        this.retailerRepository = retailerRepository;
        this.verificationQueueService = verificationQueueService;
        this.verificationDocumentService = verificationDocumentService;
    }

    @Override
    public RetailerDTO createRetailer(RetailerDTO retailerDTO) {
        validateIdentifiers(retailerDTO, null);
        Retailer retailer = mapToEntity(retailerDTO);
        // Server-set, not caller-supplied: a plain POST (unlike /register, which already forced
        // this) used to persist whatever status the caller sent, including an already-VERIFIED
        // one - every retailer starts PENDING_VERIFICATION regardless of entry point.
        retailer.setRetailerStatus("PENDING_VERIFICATION");
        Retailer savedRetailer = retailerRepository.save(retailer);
        return mapToDTO(savedRetailer);
    }

    @Override
    public RetailerDTO getRetailerById(UUID retailerId) {
        Retailer retailer = retailerRepository.findById(retailerId)
                .orElseThrow(() -> new RetailerNotFoundException("Retailer not found with id: " + retailerId));
        return mapToDTO(retailer);
    }

    @Override
    public RetailerDTO getRetailerByUserAccountId(UUID userAccountId) {
        Retailer retailer = retailerRepository.findByUserAccountId(userAccountId)
                .orElseThrow(() -> new RetailerNotFoundException("No retailer profile for user account: " + userAccountId));
        return mapToDTO(retailer);
    }

    @Override
    public List<RetailerDTO> getAllRetailers() {
        return retailerRepository.findAll().stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public RetailerDTO updateRetailer(UUID retailerId, RetailerDTO retailerDTO) {
        Retailer existingRetailer = retailerRepository.findById(retailerId)
                .orElseThrow(() -> new RetailerNotFoundException("Retailer not found with id: " + retailerId));
        validateIdentifiers(retailerDTO, existingRetailer);

        existingRetailer.setUserAccountId(retailerDTO.getUserAccountId());
        existingRetailer.setOperationsManagerId(retailerDTO.getOperationsManagerId());
        existingRetailer.setCityId(retailerDTO.getCityId());
        existingRetailer.setZoneId(retailerDTO.getZoneId());
        existingRetailer.setLongitude(retailerDTO.getLongitude());
        existingRetailer.setLatitude(retailerDTO.getLatitude());
        existingRetailer.setBusinessName(retailerDTO.getBusinessName());
        existingRetailer.setRegistrationNumber(retailerDTO.getRegistrationNumber());
        existingRetailer.setGstNumber(retailerDTO.getGstNumber());
        existingRetailer.setRetailerStatus(retailerDTO.getRetailerStatus());
        existingRetailer.setOpen(retailerDTO.isOpen());
        existingRetailer.setOpensAt(retailerDTO.getOpensAt());
        existingRetailer.setClosesAt(retailerDTO.getClosesAt());

        Retailer updatedRetailer = retailerRepository.save(existingRetailer);
        return mapToDTO(updatedRetailer);
    }

    @Override
    public void deleteRetailer(UUID retailerId) {
        if (!retailerRepository.existsById(retailerId)) {
            throw new RetailerNotFoundException("Retailer not found with id: " + retailerId);
        }
        retailerRepository.deleteById(retailerId);
    }

    @Override
    public List<RetailerDTO> getRetailersByCity(UUID cityId) {
        return retailerRepository.findByCityId(cityId).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<RetailerDTO> getVerifiedRetailersByZone(UUID zoneId) {
        return retailerRepository.findByZoneIdAndRetailerStatus(zoneId, "VERIFIED").stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<UUID> getOpenRetailerIds() {
        java.time.LocalTime now = java.time.LocalTime.now();
        return retailerRepository.findAll().stream()
                .filter(Retailer::isOpen)
                .filter(retailer -> {
                    java.time.LocalTime opens = retailer.getOpensAt();
                    java.time.LocalTime closes = retailer.getClosesAt();
                    if (opens == null || closes == null) {
                        return true; // No hours configured yet - treat as always-open.
                    }
                    // Handles an overnight window (e.g. opens 20:00, closes 02:00) as well as a
                    // same-day one.
                    return closes.isAfter(opens)
                            ? !now.isBefore(opens) && now.isBefore(closes)
                            : !now.isBefore(opens) || now.isBefore(closes);
                })
                .map(Retailer::getRetailerId)
                .collect(Collectors.toList());
    }

    @Override
    public List<RetailerDTO> getRetailersByStatus(String status) {
        return retailerRepository.findByRetailerStatus(status).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<RetailerDTO> searchRetailers(String businessName) {
        return retailerRepository.findByBusinessNameContainingIgnoreCase(businessName).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    /**
     * GSTIN and shop registration number must match their format - but only when the value is new or being changed:
     * a retailer saving an unrelated part of their profile resends the stored values, and a value stored before these
     * rules existed must not block that. (A blank value is allowed on update - it clears the field; onboarding requires both.)
     */
    private void validateIdentifiers(RetailerDTO dto, Retailer existing) {
        String gst = dto.getGstNumber();
        if (gst != null && (existing == null || !gst.equals(existing.getGstNumber()))
                && !com.example.lbos.validation.BusinessIdentifierRules.isValidGstin(gst)) {
            throw new IllegalArgumentException(com.example.lbos.validation.BusinessIdentifierRules.GSTIN_MESSAGE);
        }
        String registration = dto.getRegistrationNumber();
        if (registration != null && (existing == null || !registration.equals(existing.getRegistrationNumber()))
                && !com.example.lbos.validation.BusinessIdentifierRules.isValidRegistration(registration)) {
            throw new IllegalArgumentException(com.example.lbos.validation.BusinessIdentifierRules.REGISTRATION_MESSAGE);
        }
    }

    @Override
    public RetailerDTO registerRetailer(RetailerDTO retailerDTO) {
        // Onboarding needs the identifiers a verifier checks the documents against (their FORMAT is checked in createRetailer)
        if (retailerDTO.getRegistrationNumber() == null) {
            throw new IllegalArgumentException(com.example.lbos.validation.BusinessIdentifierRules.REGISTRATION_REQUIRED_MESSAGE);
        }
        if (retailerDTO.getGstNumber() == null) {
            throw new IllegalArgumentException(com.example.lbos.validation.BusinessIdentifierRules.GSTIN_REQUIRED_MESSAGE);
        }
        if (retailerDTO.getZoneId() == null) {
            throw new IllegalArgumentException("Select a valid zone.");
        }
        retailerDTO.setRetailerStatus("PENDING_VERIFICATION");
        return createRetailer(retailerDTO);
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public UUID submitRetailerDocuments(UUID retailerId, List<com.example.lbos.dto.VerificationDocumentDTO> documents) {
        Retailer retailer = retailerRepository.findById(retailerId)
                .orElseThrow(() -> new RetailerNotFoundException("Retailer not found with id: " + retailerId));
        
        // Find the currently open queue for this retailer, or start a new one - never blindly
        // grab the first entry in getVerificationQueuesBySubjectId, which also includes
        // already-decided (APPROVED/REJECTED) history from earlier submission rounds.
        java.util.Optional<com.example.lbos.dto.VerificationQueueDTO> activeQueue =
                verificationQueueService.getActiveVerificationQueueForSubject(retailerId);
        com.example.lbos.dto.VerificationQueueDTO queueDTO;
        if (activeQueue.isEmpty()) {
            queueDTO = new com.example.lbos.dto.VerificationQueueDTO();
            queueDTO.setSubjectType("RETAILER");
            queueDTO.setSubjectId(retailerId);
            queueDTO.setZoneId(retailer.getZoneId());
            queueDTO.setIsActive(true);
            queueDTO.setVerificationStatus("DOCUMENTS_SUBMITTED");
            queueDTO.setSubmittedByAccountId(retailer.getUserAccountId());
            queueDTO = verificationQueueService.createVerificationQueue(queueDTO);
        } else {
            queueDTO = activeQueue.get();
            queueDTO.setVerificationStatus("DOCUMENTS_SUBMITTED");
            queueDTO = verificationQueueService.updateVerificationQueue(queueDTO.getVerificationQueueId(), queueDTO);
        }

        // Real files are stored only by VerificationDocumentService.uploadVerificationDocument().
        // Do not create metadata-only placeholder rows here: they previously appeared as duplicate,
        // non-previewable documents in the Location Manager queue.
        return queueDTO.getVerificationQueueId();
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void submitRetailerForVerification(UUID retailerId) {
        Retailer retailer = retailerRepository.findById(retailerId)
                .orElseThrow(() -> new RetailerNotFoundException("Retailer not found with id: " + retailerId));

        com.example.lbos.dto.VerificationQueueDTO queue = verificationQueueService.getActiveVerificationQueueForSubject(retailerId)
                .orElseThrow(() -> new com.example.lbos.exception.VerificationQueueNotFoundException(
                        "No active verification queue found for retailer: " + retailerId));

        // Common flip-to-SENT_TO_LOCATION_MANAGER + zone-based Location Manager dispatch,
        // shared with FLEET_OWNER/DRIVER/VEHICLE submissions - see
        // VerificationQueueServiceImpl.submitForVerification/dispatchToLocationManager.
        verificationQueueService.submitForVerification(queue.getVerificationQueueId());

        retailer.setRetailerStatus("SENT_TO_LOCATION_MANAGER");
        retailerRepository.save(retailer);
    }

    @Override
    public String getRetailerVerificationStatus(UUID retailerId) {
        java.util.Optional<com.example.lbos.dto.VerificationQueueDTO> activeQueue =
                verificationQueueService.getActiveVerificationQueueForSubject(retailerId);
        if (activeQueue.isPresent()) {
            return activeQueue.get().getVerificationStatus();
        }
        // No open queue - report the most recent decided one, if this retailer has ever submitted.
        return verificationQueueService.getVerificationQueuesBySubjectId(retailerId).stream()
                .max(java.util.Comparator.comparing(com.example.lbos.dto.VerificationQueueDTO::getCreatedAt))
                .map(com.example.lbos.dto.VerificationQueueDTO::getVerificationStatus)
                .orElse("NO_VERIFICATION");
    }

    @Override
    public String getRetailerVerificationRejectionReason(UUID retailerId) {
        return verificationQueueService.getVerificationQueuesBySubjectId(retailerId).stream()
                .max(java.util.Comparator.comparing(com.example.lbos.dto.VerificationQueueDTO::getCreatedAt))
                .map(com.example.lbos.dto.VerificationQueueDTO::getRejectionReason)
                .orElse(null);
    }

    private Retailer mapToEntity(RetailerDTO dto) {
        Retailer entity = new Retailer();
        entity.setRetailerId(dto.getRetailerId());
        entity.setUserAccountId(dto.getUserAccountId());
        entity.setOperationsManagerId(dto.getOperationsManagerId());
        entity.setCityId(dto.getCityId());
        entity.setZoneId(dto.getZoneId());
        entity.setLongitude(dto.getLongitude());
        entity.setLatitude(dto.getLatitude());
        entity.setBusinessName(dto.getBusinessName());
        entity.setRegistrationNumber(dto.getRegistrationNumber());
        entity.setGstNumber(dto.getGstNumber());
        entity.setRetailerStatus(dto.getRetailerStatus());
        entity.setOpen(dto.isOpen());
        entity.setOpensAt(dto.getOpensAt());
        entity.setClosesAt(dto.getClosesAt());
        return entity;
    }

    private RetailerDTO mapToDTO(Retailer entity) {
        RetailerDTO dto = new RetailerDTO();
        dto.setRetailerId(entity.getRetailerId());
        dto.setUserAccountId(entity.getUserAccountId());
        dto.setOperationsManagerId(entity.getOperationsManagerId());
        dto.setCityId(entity.getCityId());
        dto.setZoneId(entity.getZoneId());
        dto.setLongitude(entity.getLongitude());
        dto.setLatitude(entity.getLatitude());
        dto.setBusinessName(entity.getBusinessName());
        dto.setRegistrationNumber(entity.getRegistrationNumber());
        dto.setGstNumber(entity.getGstNumber());
        dto.setRetailerStatus(entity.getRetailerStatus());
        dto.setOpen(entity.isOpen());
        dto.setOpensAt(entity.getOpensAt());
        dto.setClosesAt(entity.getClosesAt());
        return dto;
    }

    @Override
    public java.util.Optional<com.example.lbos.dto.VerificationQueueDTO> getActiveVerificationQueueForSubjectForController(java.util.UUID subjectId) {
        return verificationQueueService.getActiveVerificationQueueForSubject(subjectId);
    }

    @Override
    public String getRejectedCurrentDocumentTypesForController(java.util.UUID verificationQueueId) {
        return verificationDocumentService.getVerificationDocumentsByQueueId(verificationQueueId).stream()
                .filter(doc -> "REJECTED".equalsIgnoreCase(doc.getDocumentStatus()))
                .map(com.example.lbos.dto.VerificationDocumentDTO::getDocumentTypeName)
                .sorted()
                .collect(java.util.stream.Collectors.joining(","));
    }
}
