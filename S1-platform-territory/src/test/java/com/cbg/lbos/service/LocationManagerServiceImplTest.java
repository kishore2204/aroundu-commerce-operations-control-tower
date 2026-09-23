package com.cbg.lbos.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.cbg.lbos.client.S2PartnerClient;
import com.cbg.lbos.dto.LocationManagerDto;
import com.cbg.lbos.entity.AssignmentStatus;
import com.cbg.lbos.entity.City;
import com.cbg.lbos.entity.LocationManager;
import com.cbg.lbos.entity.OperationsManager;
import com.cbg.lbos.entity.State;
import com.cbg.lbos.entity.UserAccount;
import com.cbg.lbos.entity.Zone;
import com.cbg.lbos.exception.DuplicateResourceException;
import com.cbg.lbos.exception.InvalidAssignmentException;
import com.cbg.lbos.exception.ResourceNotFoundException;
import com.cbg.lbos.repository.LocationManagerRepository;
import com.cbg.lbos.repository.OperationsManagerRepository;
import com.cbg.lbos.repository.UserAccountRepository;
import com.cbg.lbos.repository.ZoneRepository;
import feign.FeignException;
import feign.Request;
import feign.RequestTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.nio.charset.StandardCharsets;

@ExtendWith(MockitoExtension.class)
class LocationManagerServiceImplTest {
    @Mock LocationManagerRepository locationManagerRepository;
    @Mock UserAccountRepository userAccountRepository;
    @Mock ZoneRepository zoneRepository;
    @Mock OperationsManagerRepository operationsManagerRepository;
    @Mock S2PartnerClient s2PartnerClient;
    @Mock com.cbg.lbos.repository.LocationManagerAssignmentHistoryRepository historyRepository;
    @Mock UserAccountService userAccountService;

    private LocationManagerServiceImpl locationManagerService;
    private UUID userAccountId;
    private UUID zoneId;
    private UUID cityId;
    private UUID stateId;
    private UUID operationsManagerId;
    private UUID operationsManagerAccountId;
    private UUID locationManagerId;
    private UserAccount userAccount;
    private UserAccount operationsManagerAccount;
    private State state;
    private City city;
    private Zone zone;
    private OperationsManager operationsManager;
    private LocationManager locationManager;

    @BeforeEach
    void setUp() {
        locationManagerService = new LocationManagerServiceImpl(
                locationManagerRepository, userAccountRepository, zoneRepository, operationsManagerRepository,
                s2PartnerClient, userAccountService, historyRepository);
        userAccountId = UUID.randomUUID();
        zoneId = UUID.randomUUID();
        cityId = UUID.randomUUID();
        stateId = UUID.randomUUID();
        operationsManagerId = UUID.randomUUID();
        operationsManagerAccountId = UUID.randomUUID();
        locationManagerId = UUID.randomUUID();

        state = new State();
        org.springframework.test.util.ReflectionTestUtils.setField(state, "id", stateId);
        state.setStateName("Tamil Nadu");
        state.setCountryCode("IN");

        city = new City();
        city.setId(cityId);
        city.setCityName("Chennai");
        city.setState(state);
        city.setIsActive(true);

        userAccount = new UserAccount();
        org.springframework.test.util.ReflectionTestUtils.setField(userAccount, "id", userAccountId);
        userAccount.setEmail("location@example.com");
        userAccount.setFirstName("Location");
        userAccount.setLastName("Manager");
        userAccount.setRole("LOCATION_MANAGER");
        userAccount.setAccountStatus("ACTIVE");

        operationsManagerAccount = new UserAccount();
        org.springframework.test.util.ReflectionTestUtils.setField(operationsManagerAccount, "id", operationsManagerAccountId);
        operationsManagerAccount.setEmail("operations@example.com");
        operationsManagerAccount.setFirstName("Operations");
        operationsManagerAccount.setLastName("Manager");
        operationsManagerAccount.setRole("OPERATIONS_MANAGER");
        operationsManagerAccount.setAccountStatus("ACTIVE");

        zone = new Zone();
        org.springframework.test.util.ReflectionTestUtils.setField(zone, "id", zoneId);
        zone.setCity(city);
        zone.setZoneName("North Zone");
        zone.setIsActive(true);

        operationsManager = new OperationsManager();
        operationsManager.setUserAccount(operationsManagerAccount);
        operationsManager.setCity(city);
        operationsManager.setAssignmentStatus(AssignmentStatus.ACTIVE);
        operationsManager.setAssignedAt(java.time.OffsetDateTime.now());
        org.springframework.test.util.ReflectionTestUtils.setField(operationsManager, "id", operationsManagerId);

        locationManager = new LocationManager();
        org.springframework.test.util.ReflectionTestUtils.setField(locationManager, "id", locationManagerId);
        locationManager.setUserAccount(userAccount);
        locationManager.setZone(zone);
        locationManager.setOperationsManager(operationsManager);
        locationManager.setAssignmentStatus(AssignmentStatus.ACTIVE);
        locationManager.setAssignedAt(java.time.OffsetDateTime.now());
    }

    private LocationManagerDto request() {
        LocationManagerDto dto = new LocationManagerDto();
        dto.setUserAccountId(userAccountId);
        dto.setZoneId(zoneId);
        dto.setOperationsManagerId(operationsManagerId);
        return dto;
    }

    @Test
    void assignLocationManagerCreatesActiveAssignment() {
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));
        when(locationManagerRepository.existsByUserAccountId(userAccountId)).thenReturn(false);
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(operationsManagerRepository.findById(operationsManagerId)).thenReturn(Optional.of(operationsManager));
        when(locationManagerRepository.save(any(LocationManager.class))).thenAnswer(invocation -> {
            LocationManager saved = invocation.getArgument(0);
            org.springframework.test.util.ReflectionTestUtils.setField(saved, "id", locationManagerId);
            return saved;
        });

        LocationManagerDto result = locationManagerService.assignLocationManager(request());

        assertEquals(locationManagerId, result.getLocationManagerId());
        assertEquals(userAccountId, result.getUserAccountId());
        assertEquals(zoneId, result.getZoneId());
        assertEquals(operationsManagerId, result.getOperationsManagerId());
        assertEquals(AssignmentStatus.ACTIVE, result.getAssignmentStatus());
        verify(locationManagerRepository).save(any(LocationManager.class));
    }

    @Test
    void assignRejectsUserWithExistingProfile() {
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));
        when(locationManagerRepository.existsByUserAccountId(userAccountId)).thenReturn(true);

        assertThrows(DuplicateResourceException.class,
                () -> locationManagerService.assignLocationManager(request()));
        verifyNoInteractions(zoneRepository, operationsManagerRepository);
    }

    @Test
    void assignRejectsInactiveUser() {
        userAccount.setAccountStatus("INACTIVE");
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));

        assertThrows(InvalidAssignmentException.class,
                () -> locationManagerService.assignLocationManager(request()));
    }

    @Test
    void assignRejectsWrongUserRole() {
        userAccount.setRole("SERVICE");
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));

        assertThrows(InvalidAssignmentException.class,
                () -> locationManagerService.assignLocationManager(request()));
    }

    @Test
    void assignAllowsASecondLocationManagerInAZoneThatAlreadyHasOne() {
        // the zone already has an active officer: that must no longer matter, and nobody else is touched
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));
        when(locationManagerRepository.existsByUserAccountId(userAccountId)).thenReturn(false);
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(operationsManagerRepository.findById(operationsManagerId)).thenReturn(Optional.of(operationsManager));
        when(locationManagerRepository.save(any(LocationManager.class))).thenAnswer(invocation -> invocation.getArgument(0));

        LocationManagerDto result = locationManagerService.assignLocationManager(request());

        assertEquals(zoneId, result.getZoneId());
        assertEquals(AssignmentStatus.ACTIVE, result.getAssignmentStatus());
        verify(locationManagerRepository, never()).delete(any());
        verify(locationManagerRepository, times(1)).save(any(LocationManager.class));
    }

    @Test
    void assignRejectsTheSameOfficerTwice() {
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));
        when(locationManagerRepository.existsByUserAccountId(userAccountId)).thenReturn(true);

        assertThrows(DuplicateResourceException.class,
                () -> locationManagerService.assignLocationManager(request()));
        verify(locationManagerRepository, never()).save(any());
    }

    @Test
    void assignRejectsDifferentCity() {
        City differentCity = new City();
        differentCity.setId(UUID.randomUUID());
        differentCity.setCityName("Madurai");
        differentCity.setState(state);
        differentCity.setIsActive(true);
        operationsManager.setCity(differentCity);
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));
        when(locationManagerRepository.existsByUserAccountId(userAccountId)).thenReturn(false);
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(operationsManagerRepository.findById(operationsManagerId)).thenReturn(Optional.of(operationsManager));

        assertThrows(InvalidAssignmentException.class,
                () -> locationManagerService.assignLocationManager(request()));
    }

    @Test
    void getLocationManagerByIdReturnsDto() {
        when(locationManagerRepository.findById(locationManagerId)).thenReturn(Optional.of(locationManager));

        LocationManagerDto result = locationManagerService.getLocationManagerById(locationManagerId);

        assertEquals(locationManagerId, result.getLocationManagerId());
        assertEquals("Location", result.getFirstName());
        assertEquals("Manager", result.getLastName());
        assertEquals("North Zone", result.getZoneName());
        assertEquals("Chennai", result.getCityName());
    }

    @Test
    void getLocationManagerByIdThrowsWhenMissing() {
        when(locationManagerRepository.findById(locationManagerId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class,
                () -> locationManagerService.getLocationManagerById(locationManagerId));
    }

    @Test
    void getActiveLocationManagerByZoneReturnsAssignment() {
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(locationManagerRepository.findByZoneIdAndAssignmentStatusOrderByAssignedAtAsc(zoneId, AssignmentStatus.ACTIVE))
                .thenReturn(List.of(locationManager));

        LocationManagerDto result = locationManagerService.getActiveLocationManagerByZone(zoneId);

        assertEquals(locationManagerId, result.getLocationManagerId());
    }

    @Test
    void aZoneWithSeveralActiveLocationManagersListsAllOfThemAndTheSingleLookupNoLongerFails() {
        LocationManager second = new LocationManager();
        UUID secondId = UUID.randomUUID();
        org.springframework.test.util.ReflectionTestUtils.setField(second, "id", secondId);
        UserAccount secondAccount = new UserAccount();
        org.springframework.test.util.ReflectionTestUtils.setField(secondAccount, "id", UUID.randomUUID());
        secondAccount.setFirstName("Second");
        secondAccount.setLastName("Officer");
        second.setUserAccount(secondAccount);
        second.setZone(zone);
        second.setOperationsManager(operationsManager);
        second.setAssignmentStatus(AssignmentStatus.ACTIVE);
        second.setAssignedAt(java.time.OffsetDateTime.now());
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(locationManagerRepository.findByZoneIdAndAssignmentStatusOrderByAssignedAtAsc(zoneId, AssignmentStatus.ACTIVE))
                .thenReturn(List.of(locationManager, second));

        List<LocationManagerDto> all = locationManagerService.getActiveLocationManagersByZone(zoneId);
        LocationManagerDto single = locationManagerService.getActiveLocationManagerByZone(zoneId);

        assertEquals(List.of(locationManagerId, secondId), all.stream().map(LocationManagerDto::getLocationManagerId).toList());
        assertEquals(locationManagerId, single.getLocationManagerId());
    }

    @Test
    void getActiveLocationManagerByZoneThrowsWhenNoneExists() {
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(locationManagerRepository.findByZoneIdAndAssignmentStatusOrderByAssignedAtAsc(zoneId, AssignmentStatus.ACTIVE))
                .thenReturn(List.of());

        assertThrows(ResourceNotFoundException.class,
                () -> locationManagerService.getActiveLocationManagerByZone(zoneId));
    }

    @Test
    void getLocationManagersUsesSearchQuery() {
        Pageable pageable = PageRequest.of(0, 10);
        when(locationManagerRepository.search(zoneId, operationsManagerId, AssignmentStatus.ACTIVE, pageable))
                .thenReturn(new PageImpl<>(List.of(locationManager)));

        Page<LocationManagerDto> result = locationManagerService.getLocationManagers(
                zoneId, operationsManagerId, AssignmentStatus.ACTIVE, pageable);

        assertEquals(1, result.getTotalElements());
        assertEquals(locationManagerId, result.getContent().get(0).getLocationManagerId());
    }

    @Test
    void transferLocationManagerChangesZoneAndOperationsManager() {
        UUID newZoneId = UUID.randomUUID();
        when(locationManagerRepository.findById(locationManagerId)).thenReturn(Optional.of(locationManager));
        when(zoneRepository.findById(newZoneId)).thenReturn(Optional.of(otherZone(newZoneId, "South Zone")));
        when(s2PartnerClient.getPendingReviewCount(eq(userAccountId), any()))
                .thenReturn(new S2PartnerClient.PendingReviewCountResponse(0));
        when(operationsManagerRepository.findById(operationsManagerId)).thenReturn(Optional.of(operationsManager));
        when(locationManagerRepository.save(locationManager)).thenReturn(locationManager);

        LocationManagerDto result = locationManagerService.transferLocationManager(locationManagerId, requestFor(newZoneId));

        assertEquals(newZoneId, result.getZoneId());
        assertEquals(operationsManagerId, result.getOperationsManagerId());
        assertEquals(AssignmentStatus.ACTIVE, result.getAssignmentStatus());
        verify(locationManagerRepository).save(locationManager);
    }

    @Test
    void transferToTheOfficersCurrentZoneIsRejectedAndNothingIsWritten() {
        when(locationManagerRepository.findById(locationManagerId)).thenReturn(Optional.of(locationManager));
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));

        InvalidAssignmentException failure = assertThrows(InvalidAssignmentException.class,
                () -> locationManagerService.transferLocationManager(locationManagerId, request()));

        assertEquals("Location Manager is already assigned to the selected location and zone.", failure.getMessage());
        verify(locationManagerRepository, never()).save(any());
        verify(historyRepository, never()).save(any());
    }

    @Test
    void transferToAZoneThatAlreadyHasOtherLocationManagersIsAllowed() {
        UUID newZoneId = UUID.randomUUID();
        when(locationManagerRepository.findById(locationManagerId)).thenReturn(Optional.of(locationManager));
        when(zoneRepository.findById(newZoneId)).thenReturn(Optional.of(otherZone(newZoneId, "South Zone")));
        when(s2PartnerClient.getPendingReviewCount(eq(userAccountId), any()))
                .thenReturn(new S2PartnerClient.PendingReviewCountResponse(0));
        when(operationsManagerRepository.findById(operationsManagerId)).thenReturn(Optional.of(operationsManager));
        when(locationManagerRepository.save(locationManager)).thenReturn(locationManager);

        assertEquals(newZoneId, locationManagerService.transferLocationManager(locationManagerId, requestFor(newZoneId)).getZoneId());
        verify(historyRepository).save(any());
    }

    @Test
    void changeOperationsManagerChangesManager() {
        when(locationManagerRepository.findById(locationManagerId)).thenReturn(Optional.of(locationManager));
        when(operationsManagerRepository.findById(operationsManagerId)).thenReturn(Optional.of(operationsManager));
        when(locationManagerRepository.save(locationManager)).thenReturn(locationManager);

        LocationManagerDto result = locationManagerService.changeOperationsManager(locationManagerId, request());

        assertEquals(operationsManagerId, result.getOperationsManagerId());
        verify(locationManagerRepository).save(locationManager);
    }

    @Test
    void activateAssignmentValidatesAllDependencies() {
        when(locationManagerRepository.findById(locationManagerId)).thenReturn(Optional.of(locationManager));
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(operationsManagerRepository.findById(operationsManagerId)).thenReturn(Optional.of(operationsManager));
        when(locationManagerRepository.save(locationManager)).thenReturn(locationManager);
        locationManager.setAssignmentStatus(AssignmentStatus.INACTIVE);

        LocationManagerDto result = locationManagerService.activateAssignment(locationManagerId);

        assertEquals(AssignmentStatus.ACTIVE, result.getAssignmentStatus());
        assertNotNull(result.getAssignedAt());
    }

    @Test
    void deactivateAssignmentSetsInactive() {
        when(locationManagerRepository.findById(locationManagerId)).thenReturn(Optional.of(locationManager));
        when(s2PartnerClient.getPendingReviewCount(eq(userAccountId), any()))
                .thenReturn(new S2PartnerClient.PendingReviewCountResponse(0));
        when(locationManagerRepository.save(locationManager)).thenReturn(locationManager);

        LocationManagerDto result = locationManagerService.deactivateAssignment(locationManagerId);

        assertEquals(AssignmentStatus.INACTIVE, result.getAssignmentStatus());
        verify(locationManagerRepository).save(locationManager);
    }

    @Test
    void deactivateAssignmentRejectsWhenPendingReviewsExist() {
        when(locationManagerRepository.findById(locationManagerId)).thenReturn(Optional.of(locationManager));
        when(s2PartnerClient.getPendingReviewCount(eq(userAccountId), any()))
                .thenReturn(new S2PartnerClient.PendingReviewCountResponse(3));

        assertThrows(InvalidAssignmentException.class,
                () -> locationManagerService.deactivateAssignment(locationManagerId));
        verify(locationManagerRepository, never()).save(any());
    }

    @Test
    void deactivateAssignmentFailsClosedWhenS2Unreachable() {
        when(locationManagerRepository.findById(locationManagerId)).thenReturn(Optional.of(locationManager));
        Request request = Request.create(Request.HttpMethod.GET, "/internal/v1/verification-queues/reviewer/x/pending-count",
                java.util.Collections.emptyMap(), null, StandardCharsets.UTF_8, new RequestTemplate());
        when(s2PartnerClient.getPendingReviewCount(eq(userAccountId), any()))
                .thenThrow(new FeignException.ServiceUnavailable("unavailable", request, null, null));

        assertThrows(InvalidAssignmentException.class,
                () -> locationManagerService.deactivateAssignment(locationManagerId));
        verify(locationManagerRepository, never()).save(any());
    }

    // ---- CR 11: work transfer gate, transfer history, eligible targets

    private Zone otherZone(UUID id, String name) {
        Zone other = new Zone();
        org.springframework.test.util.ReflectionTestUtils.setField(other, "id", id);
        other.setCity(city);
        other.setZoneName(name);
        other.setIsActive(true);
        return other;
    }

    private LocationManagerDto requestFor(UUID zone) {
        LocationManagerDto dto = new LocationManagerDto();
        dto.setZoneId(zone);
        dto.setOperationsManagerId(operationsManagerId);
        return dto;
    }

    @Test
    void movingAnOfficerToAnotherZoneIsBlockedWhileTheyStillHavePendingWork() {
        UUID newZoneId = UUID.randomUUID();
        when(locationManagerRepository.findById(locationManagerId)).thenReturn(Optional.of(locationManager));
        when(zoneRepository.findById(newZoneId)).thenReturn(Optional.of(otherZone(newZoneId, "South Zone")));
        when(s2PartnerClient.getPendingReviewCount(eq(userAccountId), any()))
                .thenReturn(new S2PartnerClient.PendingReviewCountResponse(2));

        assertThrows(InvalidAssignmentException.class,
                () -> locationManagerService.transferLocationManager(locationManagerId, requestFor(newZoneId)));

        assertEquals(zoneId, locationManager.getZone().getId(), "nothing may change while work remains");
        verify(locationManagerRepository, never()).save(any());
        verify(historyRepository, never()).save(any());
    }

    @Test
    void movingAnOfficerWithNoPendingWorkKeepsTheirPreviousLocationInHistory() {
        UUID newZoneId = UUID.randomUUID();
        Zone south = otherZone(newZoneId, "South Zone");
        when(locationManagerRepository.findById(locationManagerId)).thenReturn(Optional.of(locationManager));
        when(zoneRepository.findById(newZoneId)).thenReturn(Optional.of(south));
        when(s2PartnerClient.getPendingReviewCount(eq(userAccountId), any()))
                .thenReturn(new S2PartnerClient.PendingReviewCountResponse(0));
        when(operationsManagerRepository.findById(operationsManagerId)).thenReturn(Optional.of(operationsManager));
        when(locationManagerRepository.save(locationManager)).thenReturn(locationManager);

        LocationManagerDto result = locationManagerService.transferLocationManager(locationManagerId, requestFor(newZoneId));

        assertEquals(newZoneId, result.getZoneId());
        org.mockito.ArgumentCaptor<com.cbg.lbos.entity.LocationManagerAssignmentHistory> saved =
                org.mockito.ArgumentCaptor.forClass(com.cbg.lbos.entity.LocationManagerAssignmentHistory.class);
        verify(historyRepository).save(saved.capture());
        assertEquals("North Zone", saved.getValue().getFromZoneName());
        assertEquals("South Zone", saved.getValue().getToZoneName());
        assertEquals(zoneId, saved.getValue().getFromZoneId());
    }

    @Test
    void disablingAnActiveOfficersAccountIsBlockedWhileTheyHavePendingWork() {
        when(locationManagerRepository.findFirstByUserAccountIdOrderByAssignedAtDesc(userAccountId))
                .thenReturn(Optional.of(locationManager));
        when(s2PartnerClient.getPendingReviewCount(eq(userAccountId), any()))
                .thenReturn(new S2PartnerClient.PendingReviewCountResponse(1));

        assertThrows(InvalidAssignmentException.class,
                () -> locationManagerService.assertAccountStatusChangeAllowed(userAccountId, "INACTIVE"));
        // re-activating never needs the check
        locationManagerService.assertAccountStatusChangeAllowed(userAccountId, "ACTIVE");
    }

    @Test
    void transferCandidatesAreLookedUpInTheOfficersOwnState() {
        when(locationManagerRepository.findById(locationManagerId)).thenReturn(Optional.of(locationManager));
        LocationManager other = new LocationManager();
        org.springframework.test.util.ReflectionTestUtils.setField(other, "id", UUID.randomUUID());
        other.setUserAccount(userAccount);
        other.setZone(otherZone(UUID.randomUUID(), "East Zone"));
        other.setOperationsManager(operationsManager);
        other.setAssignmentStatus(AssignmentStatus.ACTIVE);
        when(locationManagerRepository.findTransferCandidates(stateId, locationManagerId, AssignmentStatus.ACTIVE))
                .thenReturn(java.util.List.of(other));

        java.util.List<LocationManagerDto> candidates = locationManagerService.getTransferCandidates(locationManagerId);

        assertEquals(1, candidates.size());
        assertEquals("East Zone", candidates.get(0).getZoneName());
        assertEquals("Chennai", candidates.get(0).getCityName());
    }
}
