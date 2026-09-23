package com.cbg.lbos.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.cbg.lbos.client.S2PartnerClient;
import com.cbg.lbos.client.S5FleetClient;
import com.cbg.lbos.entity.AssignmentStatus;
import com.cbg.lbos.entity.LocationManager;
import com.cbg.lbos.entity.OperationsManager;
import com.cbg.lbos.entity.UserAccount;
import com.cbg.lbos.exception.InvalidCredentialsException;
import com.cbg.lbos.repository.LocationManagerRepository;
import com.cbg.lbos.repository.OperationsManagerRepository;
import com.cbg.lbos.repository.UserAccountRepository;

@ExtendWith(MockitoExtension.class)
class LoginEligibilityServiceTest {

    @Mock private UserAccountRepository userAccountRepository;
    @Mock private OperationsManagerRepository operationsManagerRepository;
    @Mock private LocationManagerRepository locationManagerRepository;
    @Mock private S5FleetClient fleetClient;
    @Mock private S2PartnerClient partnerClient;

    private LoginEligibilityService service;

    @BeforeEach
    void setUp() {
        service = new LoginEligibilityService(userAccountRepository, operationsManagerRepository,
                locationManagerRepository, fleetClient, partnerClient);
    }

    private static UserAccount account(String role, String status) {
        UserAccount account = new UserAccount();
        account.setId(UUID.randomUUID());
        account.setRole(role);
        account.setAccountStatus(status);
        return account;
    }

    private static OperationsManager operationsManager(UserAccount owner, AssignmentStatus status) {
        OperationsManager operationsManager = new OperationsManager();
        operationsManager.setUserAccount(owner);
        operationsManager.setAssignmentStatus(status);
        return operationsManager;
    }

    private static LocationManager locationManager(OperationsManager supervisor, AssignmentStatus status) {
        LocationManager locationManager = new LocationManager();
        locationManager.setOperationsManager(supervisor);
        locationManager.setAssignmentStatus(status);
        return locationManager;
    }

    @Test
    void inactiveOwnAccountIsBlocked() {
        assertFalse(service.evaluate(account("CUSTOMER", "INACTIVE")).eligible());
    }

    @Test
    void activeAccountWithoutHierarchyIsAllowed() {
        assertTrue(service.evaluate(account("CUSTOMER", "ACTIVE")).eligible());
        assertTrue(service.evaluate(account("SUPER_ADMIN", "ACTIVE")).eligible());
    }

    @Test
    void operationsManagerWithInactiveAssignmentIsBlocked() {
        UserAccount owner = account("OPERATIONS_MANAGER", "ACTIVE");
        when(operationsManagerRepository.findByUserAccountId(owner.getId()))
                .thenReturn(Optional.of(operationsManager(owner, AssignmentStatus.INACTIVE)));

        assertFalse(service.evaluate(owner).eligible());
    }

    @Test
    void operationsManagerWithActiveAssignmentIsAllowed() {
        UserAccount owner = account("OPERATIONS_MANAGER", "ACTIVE");
        when(operationsManagerRepository.findByUserAccountId(owner.getId()))
                .thenReturn(Optional.of(operationsManager(owner, AssignmentStatus.ACTIVE)));

        assertTrue(service.evaluate(owner).eligible());
    }

    @Test
    void locationManagerUnderInactiveOperationsManagerAssignmentIsBlocked() {
        UserAccount lmAccount = account("LOCATION_MANAGER", "ACTIVE");
        OperationsManager supervisor = operationsManager(account("OPERATIONS_MANAGER", "ACTIVE"), AssignmentStatus.INACTIVE);
        when(locationManagerRepository.findWithSupervisorByUserAccountId(lmAccount.getId()))
                .thenReturn(Optional.of(locationManager(supervisor, AssignmentStatus.ACTIVE)));

        LoginEligibilityService.Eligibility result = service.evaluate(lmAccount);

        assertFalse(result.eligible());
        assertEquals("Your supervising Operations Manager is inactive", result.reason());
    }

    @Test
    void locationManagerUnderOperationsManagerWithInactiveAccountIsBlocked() {
        UserAccount lmAccount = account("LOCATION_MANAGER", "ACTIVE");
        OperationsManager supervisor = operationsManager(account("OPERATIONS_MANAGER", "INACTIVE"), AssignmentStatus.ACTIVE);
        when(locationManagerRepository.findWithSupervisorByUserAccountId(lmAccount.getId()))
                .thenReturn(Optional.of(locationManager(supervisor, AssignmentStatus.ACTIVE)));

        assertFalse(service.evaluate(lmAccount).eligible());
    }

    @Test
    void locationManagerWithInactiveOwnAssignmentIsBlocked() {
        UserAccount lmAccount = account("LOCATION_MANAGER", "ACTIVE");
        OperationsManager supervisor = operationsManager(account("OPERATIONS_MANAGER", "ACTIVE"), AssignmentStatus.ACTIVE);
        when(locationManagerRepository.findWithSupervisorByUserAccountId(lmAccount.getId()))
                .thenReturn(Optional.of(locationManager(supervisor, AssignmentStatus.INACTIVE)));

        assertFalse(service.evaluate(lmAccount).eligible());
    }

    @Test
    void locationManagerWithFullyActiveChainIsAllowed() {
        UserAccount lmAccount = account("LOCATION_MANAGER", "ACTIVE");
        OperationsManager supervisor = operationsManager(account("OPERATIONS_MANAGER", "ACTIVE"), AssignmentStatus.ACTIVE);
        when(locationManagerRepository.findWithSupervisorByUserAccountId(lmAccount.getId()))
                .thenReturn(Optional.of(locationManager(supervisor, AssignmentStatus.ACTIVE)));

        assertTrue(service.evaluate(lmAccount).eligible());
    }

    @Test
    void driverWhoseFleetOwnerAccountIsInactiveIsBlocked() {
        UserAccount driverAccount = account("DRIVER", "ACTIVE");
        UserAccount fleetOwnerAccount = account("FLEET_MANAGER", "INACTIVE");
        UUID fleetOwnerId = UUID.randomUUID();
        when(fleetClient.getDriverByUserAccountId(driverAccount.getId()))
                .thenReturn(new S5FleetClient.DriverStatusResponse(UUID.randomUUID(), "ACTIVE", fleetOwnerId));
        when(partnerClient.getFleetOwnerById(fleetOwnerId)).thenReturn(new S2PartnerClient.FleetOwnerValidationResponse(
                fleetOwnerId, fleetOwnerAccount.getId(), "Fleet", null, "VERIFIED", "ACTIVE", "VERIFIED"));
        when(userAccountRepository.findById(fleetOwnerAccount.getId())).thenReturn(Optional.of(fleetOwnerAccount));

        assertFalse(service.evaluate(driverAccount).eligible());
    }

    @Test
    void driverLookupFailureFailsOpen() {
        UserAccount driverAccount = account("DRIVER", "ACTIVE");
        when(fleetClient.getDriverByUserAccountId(driverAccount.getId())).thenThrow(new IllegalStateException("S5 down"));

        assertTrue(service.evaluate(driverAccount).eligible());
    }

    @Test
    void assertMayLogInThrowsInvalidCredentialsWhenBlocked() {
        assertThrows(InvalidCredentialsException.class,
                () -> service.assertMayLogIn(account("CUSTOMER", "SUSPENDED")));
    }

    @Test
    void unknownAccountIdIsNotEligible() {
        UUID id = UUID.randomUUID();
        when(userAccountRepository.findById(id)).thenReturn(Optional.empty());

        assertFalse(service.evaluate(id).eligible());
    }
}
