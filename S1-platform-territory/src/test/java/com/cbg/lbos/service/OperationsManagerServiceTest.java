package com.cbg.lbos.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.cbg.lbos.dto.OperationsManagerDtos.*;
import com.cbg.lbos.entity.AssignmentStatus;
import com.cbg.lbos.entity.City;
import com.cbg.lbos.entity.OperationsManager;
import com.cbg.lbos.entity.State;
import com.cbg.lbos.entity.UserAccount;
import com.cbg.lbos.exception.ConflictException;
import com.cbg.lbos.exception.ResourceNotFoundException;
import com.cbg.lbos.repository.CityRepository;
import com.cbg.lbos.repository.OperationsManagerRepository;
import com.cbg.lbos.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class OperationsManagerServiceTest {
    @Mock OperationsManagerRepository operationsManagerRepository;
    @Mock UserAccountRepository userAccountRepository;
    @Mock CityRepository cityRepository;

    private OperationsManagerService operationsManagerService;
    private UUID userAccountId;
    private UUID cityId;
    private UUID operationsManagerId;
    private UserAccount userAccount;
    private City city;
    private OperationsManager operationsManager;

    @BeforeEach
    void setUp() {
        operationsManagerService = new OperationsManagerService(
                operationsManagerRepository, userAccountRepository, cityRepository,
                new OperationsManagerStatusSync(operationsManagerRepository, userAccountRepository, org.mockito.Mockito.mock(com.cbg.lbos.repository.LocationManagerRepository.class)));
        userAccountId = UUID.randomUUID();
        cityId = UUID.randomUUID();
        operationsManagerId = UUID.randomUUID();

        State state = new State();
        org.springframework.test.util.ReflectionTestUtils.setField(state, "id", UUID.randomUUID());
        state.setStateName("Tamil Nadu");
        state.setCountryCode("IN");

        userAccount = new UserAccount();
        org.springframework.test.util.ReflectionTestUtils.setField(userAccount, "id", userAccountId);
        userAccount.setEmail("manager@example.com");
        userAccount.setFirstName("Operations");
        userAccount.setLastName("Manager");
        userAccount.setAccountStatus("ACTIVE");

        city = new City();
        city.setId(cityId);
        city.setCityName("Chennai");
        city.setState(state);
        city.setIsActive(true);

        operationsManager = new OperationsManager();
        org.springframework.test.util.ReflectionTestUtils.setField(operationsManager, "id", operationsManagerId);
        operationsManager.setUserAccount(userAccount);
        operationsManager.setCity(city);
        operationsManager.setAssignmentStatus(AssignmentStatus.ACTIVE);
        operationsManager.setAssignedAt(OffsetDateTime.now());
        org.springframework.test.util.ReflectionTestUtils.setField(operationsManager, "version", 1L);
    }

    @Test
    void createsAssignmentWithDefaults() {
        when(operationsManagerRepository.existsByUserAccountId(userAccountId)).thenReturn(false);
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(city));
        when(operationsManagerRepository.save(any(OperationsManager.class))).thenAnswer(invocation -> {
            OperationsManager saved = invocation.getArgument(0);
            org.springframework.test.util.ReflectionTestUtils.setField(saved, "id", operationsManagerId);
            return saved;
        });

        Response response = operationsManagerService.create(new CreateRequest(userAccountId, cityId, null, null));

        assertEquals(userAccountId, response.userAccountId());
        assertEquals(cityId, response.cityId());
        assertEquals(AssignmentStatus.ACTIVE, response.assignmentStatus());
        assertEquals("Operations Manager", response.displayName());
    }

    @Test
    void createsAssignmentWithProvidedStatusAndAssignedAt() {
        OffsetDateTime assignedAt = OffsetDateTime.now().minusDays(1);
        when(operationsManagerRepository.existsByUserAccountId(userAccountId)).thenReturn(false);
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(city));
        when(operationsManagerRepository.save(any(OperationsManager.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Response response = operationsManagerService.create(
                new CreateRequest(userAccountId, cityId, AssignmentStatus.SUSPENDED, assignedAt));

        assertEquals(AssignmentStatus.SUSPENDED, response.assignmentStatus());
        assertEquals(assignedAt, response.assignedAt());
    }

    @Test
    void rejectsDuplicateUser() {
        when(operationsManagerRepository.existsByUserAccountId(userAccountId)).thenReturn(true);
        assertThrows(ConflictException.class,
                () -> operationsManagerService.create(new CreateRequest(userAccountId, cityId, null, null)));
        verifyNoInteractions(userAccountRepository, cityRepository);
    }

    @Test
    void rejectsMissingUser() {
        when(operationsManagerRepository.existsByUserAccountId(userAccountId)).thenReturn(false);
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class,
                () -> operationsManagerService.create(new CreateRequest(userAccountId, cityId, null, null)));
    }

    @Test
    void rejectsInactiveUser() {
        userAccount.setAccountStatus("INACTIVE");
        when(operationsManagerRepository.existsByUserAccountId(userAccountId)).thenReturn(false);
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));
        assertThrows(ConflictException.class,
                () -> operationsManagerService.create(new CreateRequest(userAccountId, cityId, null, null)));
    }

    @Test
    void rejectsInactiveCity() {
        city.setIsActive(false);
        when(operationsManagerRepository.existsByUserAccountId(userAccountId)).thenReturn(false);
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(city));
        assertThrows(ConflictException.class,
                () -> operationsManagerService.create(new CreateRequest(userAccountId, cityId, null, null)));
    }

    @Test
    void getReturnsResponse() {
        when(operationsManagerRepository.findById(operationsManagerId)).thenReturn(Optional.of(operationsManager));
        Response response = operationsManagerService.get(operationsManagerId);
        assertEquals(operationsManagerId, response.id());
        assertEquals("Operations Manager", response.displayName());
    }

    @Test
    void getThrowsWhenMissing() {
        when(operationsManagerRepository.findById(operationsManagerId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> operationsManagerService.get(operationsManagerId));
    }

    @Test
    void byUserReturnsManager() {
        when(operationsManagerRepository.findByUserAccountId(userAccountId)).thenReturn(Optional.of(operationsManager));
        Response response = operationsManagerService.byUser(userAccountId);
        assertEquals(userAccountId, response.userAccountId());
    }

    @Test
    void byUserThrowsWhenMissing() {
        when(operationsManagerRepository.findByUserAccountId(userAccountId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> operationsManagerService.byUser(userAccountId));
    }

    @Test
    void listWithASearchTermUsesTheServerSideSearchWithAllThreeFilters() {
        Pageable pageable = PageRequest.of(0, 10);
        when(operationsManagerRepository.search(cityId, AssignmentStatus.SUSPENDED, "%priya%", pageable))
                .thenReturn(new PageImpl<>(List.of(operationsManager)));

        Page<Response> page = operationsManagerService.list(cityId, AssignmentStatus.SUSPENDED, "  Priya ", pageable);

        assertEquals(1, page.getTotalElements());
        verify(operationsManagerRepository, never()).findAll(any(Pageable.class));
    }

    @Test
    void listWithABlankSearchTermFallsBackToTheFilterOnlyQueries() {
        Pageable pageable = PageRequest.of(0, 10);
        when(operationsManagerRepository.findByCityId(cityId, pageable)).thenReturn(new PageImpl<>(List.of(operationsManager)));

        assertEquals(1, operationsManagerService.list(cityId, null, "   ", pageable).getTotalElements());
        assertEquals(1, operationsManagerService.list(cityId, null, null, pageable).getTotalElements());
        verify(operationsManagerRepository, never()).search(any(), any(), any(), any());
    }

    @Test
    void updatingOnlyTheCityOfASuspendedManagerDoesNotTouchTheirAccount() {
        // no status change -> the account (and its suspension) is left exactly as it is
        operationsManager.setAssignmentStatus(AssignmentStatus.SUSPENDED);
        userAccount.setAccountStatus("SUSPENDED");
        when(operationsManagerRepository.findById(operationsManagerId)).thenReturn(Optional.of(operationsManager));
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(city));

        operationsManagerService.update(operationsManagerId, new UpdateRequest(cityId, AssignmentStatus.SUSPENDED));

        assertEquals("SUSPENDED", userAccount.getAccountStatus());
        verify(userAccountRepository, never()).save(any());
    }

    @Test
    void suspendingAnOperationsManagerSuspendsTheirAccountAndReactivatingRestoresIt() {
        when(operationsManagerRepository.findById(operationsManagerId)).thenReturn(Optional.of(operationsManager));
        when(operationsManagerRepository.save(operationsManager)).thenReturn(operationsManager);
        when(operationsManagerRepository.findFirstByCityIdAndAssignmentStatus(cityId, AssignmentStatus.ACTIVE)).thenReturn(Optional.empty());

        operationsManagerService.status(operationsManagerId, new StatusRequest(AssignmentStatus.SUSPENDED));
        assertEquals("SUSPENDED", userAccount.getAccountStatus());

        operationsManagerService.status(operationsManagerId, new StatusRequest(AssignmentStatus.ACTIVE));
        assertEquals("ACTIVE", userAccount.getAccountStatus());

        operationsManagerService.status(operationsManagerId, new StatusRequest(AssignmentStatus.TRANSFERRED));
        assertEquals("ACTIVE", userAccount.getAccountStatus(), "a transfer is not an access state");
    }

    @Test
    void listUsesAllFilterCombinations() {
        Pageable pageable = PageRequest.of(0, 10);
        when(operationsManagerRepository.findByCityIdAndAssignmentStatus(cityId, AssignmentStatus.ACTIVE, pageable))
                .thenReturn(new PageImpl<>(List.of(operationsManager)));
        when(operationsManagerRepository.findByCityId(cityId, pageable))
                .thenReturn(new PageImpl<>(List.of(operationsManager)));
        when(operationsManagerRepository.findByAssignmentStatus(AssignmentStatus.ACTIVE, pageable))
                .thenReturn(new PageImpl<>(List.of(operationsManager)));
        when(operationsManagerRepository.findAll(pageable))
                .thenReturn(new PageImpl<>(List.of(operationsManager)));

        assertEquals(1, operationsManagerService.list(cityId, AssignmentStatus.ACTIVE, pageable).getTotalElements());
        assertEquals(1, operationsManagerService.list(cityId, null, pageable).getTotalElements());
        assertEquals(1, operationsManagerService.list(null, AssignmentStatus.ACTIVE, pageable).getTotalElements());
        assertEquals(1, operationsManagerService.list(null, null, pageable).getTotalElements());
    }

    @Test
    void updateChangesCityAndStatus() {
        when(operationsManagerRepository.findById(operationsManagerId)).thenReturn(Optional.of(operationsManager));
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(city));

        Response response = operationsManagerService.update(
                operationsManagerId, new UpdateRequest(cityId, AssignmentStatus.SUSPENDED));

        assertEquals(AssignmentStatus.SUSPENDED, response.assignmentStatus());
        assertEquals(cityId, response.cityId());
    }

    @Test
    void reassignMakesManagerActiveAndUpdatesAssignmentTime() {
        operationsManager.setAssignmentStatus(AssignmentStatus.INACTIVE);
        when(operationsManagerRepository.findById(operationsManagerId)).thenReturn(Optional.of(operationsManager));
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(city));
        // reassign() maps the *saved* instance (JpaRepository.save returns the managed
        // entity and never null); without this stub the mock hands back null.
        when(operationsManagerRepository.save(any(OperationsManager.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Response response = operationsManagerService.reassign(
                operationsManagerId, new ReassignCityRequest(cityId));

        assertEquals(AssignmentStatus.ACTIVE, response.assignmentStatus());
        assertNotNull(response.assignedAt());
    }

    @Test
    void statusChangesAssignmentStatus() {
        when(operationsManagerRepository.findById(operationsManagerId)).thenReturn(Optional.of(operationsManager));
        // status() maps the *saved* instance - see reassign test above.
        when(operationsManagerRepository.save(any(OperationsManager.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        Response response = operationsManagerService.status(
                operationsManagerId, new StatusRequest(AssignmentStatus.INACTIVE));
        assertEquals(AssignmentStatus.INACTIVE, response.assignmentStatus());
    }

    @Test
    void deleteMarksManagerInactive() {
        when(operationsManagerRepository.findById(operationsManagerId)).thenReturn(Optional.of(operationsManager));
        operationsManagerService.delete(operationsManagerId);
        assertEquals(AssignmentStatus.INACTIVE, operationsManager.getAssignmentStatus());
        verify(operationsManagerRepository).findById(operationsManagerId);
    }

    @Test
    void summaryReturnsCountsForAllStatuses() {
        when(operationsManagerRepository.count()).thenReturn(10L);
        when(operationsManagerRepository.countByAssignmentStatus(AssignmentStatus.ACTIVE)).thenReturn(5L);
        when(operationsManagerRepository.countByAssignmentStatus(AssignmentStatus.INACTIVE)).thenReturn(2L);
        when(operationsManagerRepository.countByAssignmentStatus(AssignmentStatus.SUSPENDED)).thenReturn(2L);
        when(operationsManagerRepository.countByAssignmentStatus(AssignmentStatus.TRANSFERRED)).thenReturn(1L);

        Summary summary = operationsManagerService.summary();

        assertEquals(10L, summary.total());
        assertEquals(5L, summary.active());
        assertEquals(2L, summary.inactive());
        assertEquals(2L, summary.suspended());
        assertEquals(1L, summary.transferred());
    }

    @Test
    void resolveReturnsActiveCapability() {
        when(operationsManagerRepository.findByUserAccountId(userAccountId)).thenReturn(Optional.of(operationsManager));

        InternalAssignment result = operationsManagerService.resolve(userAccountId);

        assertEquals(operationsManagerId, result.operationsManagerId());
        assertEquals(userAccountId, result.userAccountId());
        assertEquals(cityId, result.cityId());
        assertTrue(result.canOperate());
    }

    @Test
    void resolveReturnsFalseCapabilityForInactiveManager() {
        operationsManager.setAssignmentStatus(AssignmentStatus.INACTIVE);
        when(operationsManagerRepository.findByUserAccountId(userAccountId)).thenReturn(Optional.of(operationsManager));

        InternalAssignment result = operationsManagerService.resolve(userAccountId);

        assertFalse(result.canOperate());
        assertEquals(AssignmentStatus.INACTIVE, result.status());
    }

    @Test
    void activeCityReturnsActiveManager() {
        when(operationsManagerRepository.findFirstByCityIdAndAssignmentStatus(cityId, AssignmentStatus.ACTIVE))
                .thenReturn(Optional.of(operationsManager));

        InternalAssignment result = operationsManagerService.activeCity(cityId);

        assertEquals(operationsManagerId, result.operationsManagerId());
        assertEquals(userAccountId, result.userAccountId());
        assertEquals(cityId, result.cityId());
        assertTrue(result.canOperate());
    }

    @Test
    void activeCityThrowsWhenNoManagerExists() {
        when(operationsManagerRepository.findFirstByCityIdAndAssignmentStatus(cityId, AssignmentStatus.ACTIVE))
                .thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> operationsManagerService.activeCity(cityId));
    }

    @Test
    void validateReturnsValidForMatchingActiveManager() {
        when(operationsManagerRepository.findById(operationsManagerId)).thenReturn(Optional.of(operationsManager));

        ValidationResponse result = operationsManagerService.validate(operationsManagerId, cityId);

        assertTrue(result.valid());
        assertEquals("Valid active city assignment", result.reason());
    }

    @Test
    void validateReturnsFalseWhenManagerDoesNotExist() {
        when(operationsManagerRepository.findById(operationsManagerId)).thenReturn(Optional.empty());
        ValidationResponse result = operationsManagerService.validate(operationsManagerId, cityId);
        assertFalse(result.valid());
        assertEquals("Operations manager does not exist", result.reason());
    }

    @Test
    void validateReturnsFalseWhenManagerInactive() {
        operationsManager.setAssignmentStatus(AssignmentStatus.INACTIVE);
        when(operationsManagerRepository.findById(operationsManagerId)).thenReturn(Optional.of(operationsManager));
        ValidationResponse result = operationsManagerService.validate(operationsManagerId, cityId);
        assertFalse(result.valid());
        assertEquals("Assignment is not ACTIVE", result.reason());
    }

    @Test
    void validateReturnsFalseWhenCityDoesNotMatch() {
        when(operationsManagerRepository.findById(operationsManagerId)).thenReturn(Optional.of(operationsManager));
        UUID anotherCityId = UUID.randomUUID();
        ValidationResponse result = operationsManagerService.validate(operationsManagerId, anotherCityId);
        assertFalse(result.valid());
        assertEquals("Operations manager is not assigned to the requested city", result.reason());
    }
}
