package com.cbg.lbos.service;

import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.cbg.lbos.client.S2PartnerClient;
import com.cbg.lbos.dto.CreateOfficerRequestDto;
import com.cbg.lbos.dto.LocationManagerDto;
import com.cbg.lbos.dto.UserAccountRequestDto;
import com.cbg.lbos.entity.*;
import com.cbg.lbos.exception.*;
import com.cbg.lbos.repository.*;
import feign.FeignException;

@Service
@Transactional
public class LocationManagerServiceImpl implements LocationManagerService {
    private final LocationManagerRepository locationManagerRepository;
    private final UserAccountRepository userAccountRepository;
    private final ZoneRepository zoneRepository;
    private final OperationsManagerRepository operationsManagerRepository;
    private final S2PartnerClient s2PartnerClient;
    private final UserAccountService userAccountService;
    private final LocationManagerAssignmentHistoryRepository historyRepository;
    private final OperationsManagerStatusSync statusSync;

    public LocationManagerServiceImpl(LocationManagerRepository locationManagerRepository,
                                      UserAccountRepository userAccountRepository,
                                      ZoneRepository zoneRepository,
                                      OperationsManagerRepository operationsManagerRepository,
                                      S2PartnerClient s2PartnerClient,
                                      UserAccountService userAccountService,
                                      LocationManagerAssignmentHistoryRepository historyRepository,
                                      OperationsManagerStatusSync statusSync) {
        this.historyRepository = historyRepository;
        this.statusSync = statusSync;
        this.locationManagerRepository = locationManagerRepository;
        this.userAccountRepository = userAccountRepository;
        this.zoneRepository = zoneRepository;
        this.operationsManagerRepository = operationsManagerRepository;
        this.s2PartnerClient = s2PartnerClient;
        this.userAccountService = userAccountService;
    }

    /**
     * Creates the LOCATION_MANAGER account then assigns it to the requested zone under the
     * calling Operations Manager - never a client-supplied operationsManagerId, so an
     * Operations Manager can only ever create officers under their own supervision. Phone
     * number is required by UserAccountService but not part of this form, so a placeholder is
     * generated the same way DriverServiceImpl does for driver accounts.
     */
    public LocationManagerDto createOfficer(CreateOfficerRequestDto request, UUID creatorUserAccountId) {
        OperationsManager creator = operationsManagerRepository.findByUserAccountId(creatorUserAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("No Operations Manager assignment for user: " + creatorUserAccountId));
        if (creator.getAssignmentStatus() != AssignmentStatus.ACTIVE) {
            throw new InvalidAssignmentException("Your Operations Manager assignment is not active");
        }

        UserAccountRequestDto accountRequest = new UserAccountRequestDto();
        accountRequest.setFirstName(request.getFirstName());
        accountRequest.setLastName(request.getLastName());
        accountRequest.setEmail(request.getEmail());
        accountRequest.setPassword(request.getPassword());
        accountRequest.setPhoneNumber("999" + String.format("%07d", new java.util.Random().nextInt(10000000)));
        accountRequest.setRole("LOCATION_MANAGER");
        accountRequest.setAccountStatus("ACTIVE");
        UUID newUserAccountId = userAccountService.createUserAccount(accountRequest).getId();

        LocationManagerDto assignmentRequest = new LocationManagerDto();
        assignmentRequest.setUserAccountId(newUserAccountId);
        assignmentRequest.setZoneId(request.getZoneId());
        assignmentRequest.setOperationsManagerId(creator.getId());
        return assignLocationManager(assignmentRequest);
    }

    public LocationManagerDto assignLocationManager(LocationManagerDto request) {
        UserAccount userAccount = findUserAccount(request.getUserAccountId());
        validateEligibleUser(userAccount);
        if (locationManagerRepository.existsByUserAccountId(userAccount.getId())) {
            throw new DuplicateResourceException("User already has a Location Manager profile");
        }
        Zone zone = findActiveZone(request.getZoneId());
        // a zone may have several Location Managers - other officers already in it are left exactly as they are
        OperationsManager operationsManager = findActiveOperationsManager(request.getOperationsManagerId());
        validateSameCity(operationsManager, zone);

        LocationManager locationManager = new LocationManager();
        locationManager.setUserAccount(userAccount);
        locationManager.setZone(zone);
        locationManager.setOperationsManager(operationsManager);
        locationManager.setAssignmentStatus(AssignmentStatus.ACTIVE);
        locationManager.setAssignedAt(OffsetDateTime.now());
        return toDto(locationManagerRepository.save(locationManager));
    }

    @Transactional(readOnly = true)
    public LocationManagerDto getLocationManagerById(UUID locationManagerId) {
        return withLastTransfer(toDto(findLocationManager(locationManagerId)));
    }

    @Transactional(readOnly = true)
    public LocationManagerDto getByUserAccountId(UUID userAccountId) {
        return toDto(locationManagerRepository.findFirstByUserAccountIdOrderByAssignedAtDesc(userAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("No Location Manager assignment for user: " + userAccountId)));
    }

    @Transactional(readOnly = true)
    public LocationManagerDto getActiveLocationManagerByZone(UUID zoneId) {
        return getActiveLocationManagersByZone(zoneId).stream().findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("No active Location Manager for Zone: " + zoneId));
    }

    @Transactional(readOnly = true)
    public java.util.List<LocationManagerDto> getActiveLocationManagersByZone(UUID zoneId) {
        findActiveZone(zoneId);
        return locationManagerRepository.findByZoneIdAndAssignmentStatusOrderByAssignedAtAsc(zoneId, AssignmentStatus.ACTIVE)
                .stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public Page<LocationManagerDto> getLocationManagers(UUID zoneId, UUID operationsManagerId,
                                                        AssignmentStatus assignmentStatus, Pageable pageable) {
        return getLocationManagers(zoneId, operationsManagerId, assignmentStatus, null, pageable);
    }

    @Transactional(readOnly = true)
    public Page<LocationManagerDto> getLocationManagers(UUID zoneId, UUID operationsManagerId,
                                                        AssignmentStatus assignmentStatus, String name, Pageable pageable) {
        String term = name == null ? "" : name.trim();
        Page<LocationManager> found = term.isEmpty()
                ? locationManagerRepository.search(zoneId, operationsManagerId, assignmentStatus, pageable)
                : locationManagerRepository.searchByName(zoneId, operationsManagerId, assignmentStatus,
                        "%" + term.toLowerCase() + "%", pageable);
        Page<LocationManagerDto> page = found.map(this::toDto);
        applyLastTransfers(page.getContent());
        return page;
    }

    @Transactional(readOnly = true)
    public java.util.List<LocationManagerDto> getTransferCandidates(UUID locationManagerId) {
        LocationManager source = findLocationManager(locationManagerId);
        UUID stateId = source.getZone().getCity().getState().getId();
        return locationManagerRepository.findTransferCandidates(stateId, locationManagerId, AssignmentStatus.ACTIVE)
                .stream().map(this::toDto).toList();
    }

    public void assertAccountStatusChangeAllowed(UUID userAccountId, String newStatus) {
        if (newStatus == null || "ACTIVE".equalsIgnoreCase(newStatus.trim())) {
            return;
        }
        locationManagerRepository.findFirstByUserAccountIdOrderByAssignedAtDesc(userAccountId)
                .filter(locationManager -> locationManager.getAssignmentStatus() == AssignmentStatus.ACTIVE)
                .ifPresent(this::validateNoPendingReviews);
    }

    /*
    ##################################################################
    
                                               CR_CHG0030038_Reassign_Location_Managers_3238451
    
    #####################################################################
    */
    public LocationManagerDto transferLocationManager(UUID locationManagerId, LocationManagerDto request) {
        LocationManager locationManager = findLocationManager(locationManagerId);
        Zone zone = findActiveZone(request.getZoneId());
        // The officer's current location is never a valid destination - enforced here, not only by the screen.
        if (locationManager.getZone().getId().equals(zone.getId())) {
            throw new InvalidAssignmentException("Location Manager is already assigned to the selected location and zone.");
        }
        // Moving an officer out of a zone leaves their verification requests behind: every one of them must
        // have been handed to someone else first, and nothing below is written until that is true.
        if (locationManager.getAssignmentStatus() == AssignmentStatus.ACTIVE) {
            validateNoPendingReviews(locationManager);
        }
        OperationsManager operationsManager = findActiveOperationsManager(request.getOperationsManagerId());
        validateSameCity(operationsManager, zone);
        recordTransfer(locationManager, zone, operationsManager);
        locationManager.setZone(zone);
        locationManager.setOperationsManager(operationsManager);
        locationManager.setAssignmentStatus(AssignmentStatus.ACTIVE);
        locationManager.setAssignedAt(OffsetDateTime.now());
        return withLastTransfer(toDto(locationManagerRepository.save(locationManager)));
    }

    public LocationManagerDto changeOperationsManager(UUID locationManagerId, LocationManagerDto request) {
        LocationManager locationManager = findLocationManager(locationManagerId);
        OperationsManager operationsManager = findActiveOperationsManager(request.getOperationsManagerId());
        validateSameCity(operationsManager, locationManager.getZone());
        locationManager.setOperationsManager(operationsManager);
        return toDto(locationManagerRepository.save(locationManager));
    }

    public LocationManagerDto activateAssignment(UUID locationManagerId) {
        LocationManager locationManager = findLocationManager(locationManagerId);
        // an account switched off together with the assignment (see deactivateAssignment) is switched back on with it;
        // a SUSPENDED (blocked) account is still refused here
        if ("INACTIVE".equalsIgnoreCase(locationManager.getUserAccount().getAccountStatus())) {
            locationManager.getUserAccount().setAccountStatus("ACTIVE");
        }
        validateEligibleUser(locationManager.getUserAccount());
        findActiveZone(locationManager.getZone().getId());
        OperationsManager operationsManager = findActiveOperationsManager(locationManager.getOperationsManager().getId());
        validateSameCity(operationsManager, locationManager.getZone());
        locationManager.setAssignmentStatus(AssignmentStatus.ACTIVE);
        locationManager.setAssignedAt(OffsetDateTime.now());
        LocationManager saved = locationManagerRepository.save(locationManager);
        statusSync.locationManagerAssignmentChanged(saved);
        return toDto(saved);
    }

    public LocationManagerDto deactivateAssignment(UUID locationManagerId) {
        LocationManager locationManager = findLocationManager(locationManagerId);
        validateNoPendingReviews(locationManager);
        locationManager.setAssignmentStatus(AssignmentStatus.INACTIVE);
        LocationManager saved = locationManagerRepository.save(locationManager);
        // the admin Accounts page lists the user account, so the officer's account status follows the assignment
        statusSync.locationManagerAssignmentChanged(saved);
        return toDto(saved);
    }

    /** Keeps the officer's previous location (the LocationManager row only ever holds the current one). */
    private void recordTransfer(LocationManager current, Zone newZone, OperationsManager newOperationsManager) {
        LocationManagerAssignmentHistory entry = new LocationManagerAssignmentHistory();
        entry.setLocationManagerId(current.getId());
        entry.setFromZoneId(current.getZone().getId());
        entry.setFromZoneName(current.getZone().getZoneName());
        entry.setFromCityName(current.getZone().getCity().getCityName());
        entry.setFromOperationsManagerId(current.getOperationsManager().getId());
        entry.setFromAssignedAt(current.getAssignedAt());
        entry.setToZoneId(newZone.getId());
        entry.setToZoneName(newZone.getZoneName());
        entry.setToCityName(newZone.getCity().getCityName());
        entry.setToOperationsManagerId(newOperationsManager.getId());
        entry.setChangedAt(OffsetDateTime.now());
        historyRepository.save(entry);
    }

    private LocationManagerDto withLastTransfer(LocationManagerDto dto) {
        applyLastTransfers(java.util.List.of(dto));
        return dto;
    }

    /** One history query for the whole page; the newest entry per officer wins. */
    private void applyLastTransfers(java.util.List<LocationManagerDto> dtos) {
        if (dtos.isEmpty()) {
            return;
        }
        java.util.Map<UUID, LocationManagerAssignmentHistory> latest = new java.util.HashMap<>();
        for (LocationManagerAssignmentHistory entry : historyRepository.findByLocationManagerIdInOrderByChangedAtDesc(
                dtos.stream().map(LocationManagerDto::getLocationManagerId).toList())) {
            latest.putIfAbsent(entry.getLocationManagerId(), entry);
        }
        for (LocationManagerDto dto : dtos) {
            LocationManagerAssignmentHistory entry = latest.get(dto.getLocationManagerId());
            if (entry != null) {
                dto.setPreviousZoneName(entry.getFromZoneName());
                dto.setPreviousCityName(entry.getFromCityName());
                dto.setLastTransferredAt(entry.getChangedAt());
            }
        }
    }

    private void validateNoPendingReviews(LocationManager locationManager) {
        S2PartnerClient.PendingReviewCountResponse response;
        try {
            response = s2PartnerClient.getPendingReviewCount(
                    locationManager.getUserAccount().getId(), locationManager.getZone().getId());
        } catch (FeignException e) {
            // Fail closed: if S2 can't be reached or errors, we cannot confirm the manager has
            // no pending reviews, so we deliberately block deactivation rather than risk pulling
            // a reviewer out of rotation while items are still assigned to them.
            throw new InvalidAssignmentException(
                    "Unable to verify pending reviews for this Location Manager; deactivation blocked");
        }
        if (response.pendingCount() > 0) {
            throw new InvalidAssignmentException("Location Manager has " + response.pendingCount()
                    + " pending verification review(s) assigned; transfer their work before continuing");
        }
    }

    private LocationManager findLocationManager(UUID locationManagerId) {
        return locationManagerRepository.findById(locationManagerId)
                .orElseThrow(() -> new ResourceNotFoundException("Location Manager not found: " + locationManagerId));
    }

    private UserAccount findUserAccount(UUID userAccountId) {
        return userAccountRepository.findById(userAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("User Account not found: " + userAccountId));
    }

    private void validateEligibleUser(UserAccount userAccount) {
        if (!"ACTIVE".equalsIgnoreCase(userAccount.getAccountStatus())) {
            throw new InvalidAssignmentException("User Account is inactive");
        }
        if (!"LOCATION_MANAGER".equalsIgnoreCase(userAccount.getRole())) {
            throw new InvalidAssignmentException("User role must be LOCATION_MANAGER");
        }
    }

    private Zone findActiveZone(UUID zoneId) {
        Zone zone = zoneRepository.findById(zoneId)
                .orElseThrow(() -> new ResourceNotFoundException("Zone not found: " + zoneId));
        if (!Boolean.TRUE.equals(zone.getIsActive()) || !Boolean.TRUE.equals(zone.getCity().getIsActive())) {
            throw new InvalidAssignmentException("Zone or its City is inactive");
        }
        return zone;
    }

    private OperationsManager findActiveOperationsManager(UUID operationsManagerId) {
        OperationsManager operationsManager = operationsManagerRepository.findById(operationsManagerId)
                .orElseThrow(() -> new ResourceNotFoundException("Operations Manager not found: " + operationsManagerId));
        if (operationsManager.getAssignmentStatus() != AssignmentStatus.ACTIVE) {
            throw new InvalidAssignmentException("Operations Manager is inactive");
        }
        return operationsManager;
    }

    private void validateSameCity(OperationsManager operationsManager, Zone zone) {
        if (!operationsManager.getCity().getId().equals(zone.getCity().getId())) {
            throw new InvalidAssignmentException("Operations Manager and Zone must belong to the same City");
        }
    }

    private LocationManagerDto toDto(LocationManager locationManager) {
        LocationManagerDto dto = new LocationManagerDto();
        dto.setLocationManagerId(locationManager.getId());
        dto.setUserAccountId(locationManager.getUserAccount().getId());
        dto.setFirstName(locationManager.getUserAccount().getFirstName());
        dto.setLastName(locationManager.getUserAccount().getLastName());
        dto.setEmail(locationManager.getUserAccount().getEmail());
        dto.setZoneId(locationManager.getZone().getId());
        dto.setZoneName(locationManager.getZone().getZoneName());
        dto.setCityId(locationManager.getZone().getCity().getId());
        dto.setCityName(locationManager.getZone().getCity().getCityName());
        dto.setStateId(locationManager.getZone().getCity().getState().getId());
        dto.setOperationsManagerId(locationManager.getOperationsManager().getId());
        dto.setOperationsManagerAccountId(locationManager.getOperationsManager().getUserAccount().getId());
        dto.setAssignmentStatus(locationManager.getAssignmentStatus());
        dto.setAssignedAt(locationManager.getAssignedAt());
        return dto;
    }
}
