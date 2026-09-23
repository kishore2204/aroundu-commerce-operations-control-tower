package com.example.lbos.service;

import com.example.lbos.repository.FleetOwnerRepository;
import com.example.lbos.dto.FleetOwnerDTO;
import com.example.lbos.entity.FleetOwner;
import com.example.lbos.exception.FleetOwnerNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class FleetOwnerServiceImpl implements FleetOwnerService {

    private final FleetOwnerRepository fleetOwnerRepository;
    private final com.example.lbos.service.VerificationQueueService verificationQueueService;
    private final com.example.lbos.service.VerificationDocumentService verificationDocumentService;

    public FleetOwnerServiceImpl(FleetOwnerRepository fleetOwnerRepository,
                                 com.example.lbos.service.VerificationQueueService verificationQueueService,
                                 com.example.lbos.service.VerificationDocumentService verificationDocumentService) {
        this.fleetOwnerRepository = fleetOwnerRepository;
        this.verificationQueueService = verificationQueueService;
        this.verificationDocumentService = verificationDocumentService;
    }

    @Override
    public FleetOwnerDTO createFleetOwner(FleetOwnerDTO dto) {
        FleetOwner entity = mapToEntity(dto);
        // Server-set, not caller-supplied: a plain POST (unlike /register, which already forced
        // this) used to persist whatever status the caller sent, including an already-VERIFIED/
        // ACTIVE one - every fleet owner starts PENDING_VERIFICATION/INACTIVE regardless of
        // entry point.
        entity.setProfileStatus("PENDING_VERIFICATION");
        entity.setOwnerStatus("INACTIVE");
        FleetOwner saved = fleetOwnerRepository.save(entity);
        return mapToDTO(saved);
    }

    @Override
    public FleetOwnerDTO getFleetOwnerById(UUID id) {
        FleetOwner entity = fleetOwnerRepository.findById(id)
                .orElseThrow(() -> new FleetOwnerNotFoundException("FleetOwner not found with id: " + id));
        return mapToDTO(entity);
    }

    @Override
    public FleetOwnerDTO getFleetOwnerByUserAccountId(UUID userAccountId) {
        FleetOwner entity = fleetOwnerRepository.findByUserAccountId(userAccountId)
                .orElseThrow(() -> new FleetOwnerNotFoundException("No fleet-owner profile for user account: " + userAccountId));
        return mapToDTO(entity);
    }

    @Override
    public List<FleetOwnerDTO> getAllFleetOwners() {
        return fleetOwnerRepository.findAll().stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Override
    public FleetOwnerDTO updateFleetOwner(UUID id, FleetOwnerDTO dto) {
        FleetOwner existing = fleetOwnerRepository.findById(id)
                .orElseThrow(() -> new FleetOwnerNotFoundException("FleetOwner not found with id: " + id));

        existing.setUserAccountId(dto.getUserAccountId());
        existing.setOperationsManagerId(dto.getOperationsManagerId());
        existing.setCityId(dto.getCityId());
        existing.setZoneId(dto.getZoneId());
        existing.setBusinessName(dto.getBusinessName());
        existing.setBankVerifiedByAccountId(dto.getBankVerifiedByAccountId());
        existing.setProfileStatus(dto.getProfileStatus());
        existing.setOwnerStatus(dto.getOwnerStatus());

        FleetOwner updated = fleetOwnerRepository.save(existing);
        return mapToDTO(updated);
    }

    @Override
    public void deleteFleetOwner(UUID id) {
        if (!fleetOwnerRepository.existsById(id)) {
            throw new FleetOwnerNotFoundException("FleetOwner not found with id: " + id);
        }
        fleetOwnerRepository.deleteById(id);
    }

    @Override
    public List<FleetOwnerDTO> getFleetOwnersByCityId(UUID cityId) {
        return fleetOwnerRepository.findByCityId(cityId).stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Override
    public List<FleetOwnerDTO> getFleetOwnersByStatus(String status) {
        return fleetOwnerRepository.findByOwnerStatus(status).stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Override
    public List<FleetOwnerDTO> getFleetOwnersByProfileStatus(String profileStatus) {
        return fleetOwnerRepository.findByProfileStatus(profileStatus).stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Override
    public List<FleetOwnerDTO> searchFleetOwnersByBusinessName(String businessName) {
        return fleetOwnerRepository.findByBusinessNameContainingIgnoreCase(businessName).stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Override
    public FleetOwnerDTO registerFleetOwner(FleetOwnerDTO dto) {
        dto.setProfileStatus("PENDING_VERIFICATION");
        dto.setOwnerStatus("INACTIVE");
        return createFleetOwner(dto);
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public UUID submitFleetOwnerDocuments(UUID id, List<com.example.lbos.dto.VerificationDocumentDTO> documents) {
        FleetOwner fleetOwner = fleetOwnerRepository.findById(id)
                .orElseThrow(() -> new FleetOwnerNotFoundException("FleetOwner not found with id: " + id));
        
        // Find the currently open queue for this fleet owner, or start a new one - never
        // blindly grab the first entry in getVerificationQueuesBySubjectId, which also
        // includes already-decided (APPROVED/REJECTED) history from earlier submission rounds.
        java.util.Optional<com.example.lbos.dto.VerificationQueueDTO> activeQueue =
                verificationQueueService.getActiveVerificationQueueForSubject(id);
        com.example.lbos.dto.VerificationQueueDTO queueDTO;
        if (activeQueue.isEmpty()) {
            queueDTO = new com.example.lbos.dto.VerificationQueueDTO();
            queueDTO.setSubjectType("FLEET_OWNER");
            queueDTO.setSubjectId(id);
            queueDTO.setZoneId(fleetOwner.getZoneId());
            queueDTO.setIsActive(true);
            queueDTO.setVerificationStatus("DOCUMENTS_SUBMITTED");
            queueDTO.setSubmittedByAccountId(fleetOwner.getUserAccountId());
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
    public void submitFleetOwnerForVerification(UUID id) {
        FleetOwner fleetOwner = fleetOwnerRepository.findById(id)
                .orElseThrow(() -> new FleetOwnerNotFoundException("FleetOwner not found with id: " + id));

        com.example.lbos.dto.VerificationQueueDTO queue = verificationQueueService.getActiveVerificationQueueForSubject(id)
                .orElseThrow(() -> new com.example.lbos.exception.VerificationQueueNotFoundException(
                        "No active verification queue found for fleet owner: " + id));

        // Common flip-to-SENT_TO_LOCATION_MANAGER + zone-based Location Manager dispatch,
        // shared with RETAILER/DRIVER/VEHICLE submissions - see
        // VerificationQueueServiceImpl.submitForVerification/dispatchToLocationManager.
        verificationQueueService.submitForVerification(queue.getVerificationQueueId());

        fleetOwner.setProfileStatus("SENT_TO_LOCATION_MANAGER");
        fleetOwnerRepository.save(fleetOwner);
    }

    @Override
    public String getFleetOwnerVerificationStatus(UUID id) {
        java.util.Optional<com.example.lbos.dto.VerificationQueueDTO> activeQueue =
                verificationQueueService.getActiveVerificationQueueForSubject(id);
        if (activeQueue.isPresent()) {
            return activeQueue.get().getVerificationStatus();
        }
        // No open queue - report the most recent decided one, if this fleet owner has ever submitted.
        return verificationQueueService.getVerificationQueuesBySubjectId(id).stream()
                .max(java.util.Comparator.comparing(com.example.lbos.dto.VerificationQueueDTO::getCreatedAt))
                .map(com.example.lbos.dto.VerificationQueueDTO::getVerificationStatus)
                .orElse("NO_VERIFICATION");
    }

    @Override
    public String getFleetOwnerVerificationRejectionReason(UUID id) {
        return verificationQueueService.getVerificationQueuesBySubjectId(id).stream()
                .max(java.util.Comparator.comparing(com.example.lbos.dto.VerificationQueueDTO::getCreatedAt))
                .map(com.example.lbos.dto.VerificationQueueDTO::getRejectionReason)
                .orElse(null);
    }

    private FleetOwner mapToEntity(FleetOwnerDTO dto) {
        FleetOwner entity = new FleetOwner();
        entity.setFleetOwnerId(dto.getFleetOwnerId());
        entity.setUserAccountId(dto.getUserAccountId());
        entity.setOperationsManagerId(dto.getOperationsManagerId());
        entity.setCityId(dto.getCityId());
        entity.setZoneId(dto.getZoneId());
        entity.setBusinessName(dto.getBusinessName());
        entity.setBankVerifiedByAccountId(dto.getBankVerifiedByAccountId());
        entity.setProfileStatus(dto.getProfileStatus());
        entity.setOwnerStatus(dto.getOwnerStatus());
        return entity;
    }

    private FleetOwnerDTO mapToDTO(FleetOwner entity) {
        FleetOwnerDTO dto = new FleetOwnerDTO();
        dto.setFleetOwnerId(entity.getFleetOwnerId());
        dto.setUserAccountId(entity.getUserAccountId());
        dto.setOperationsManagerId(entity.getOperationsManagerId());
        dto.setCityId(entity.getCityId());
        dto.setZoneId(entity.getZoneId());
        dto.setBusinessName(entity.getBusinessName());
        dto.setBankVerifiedByAccountId(entity.getBankVerifiedByAccountId());
        dto.setProfileStatus(entity.getProfileStatus());
        dto.setOwnerStatus(entity.getOwnerStatus());
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
