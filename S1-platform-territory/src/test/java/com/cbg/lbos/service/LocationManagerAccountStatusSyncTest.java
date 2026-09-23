package com.cbg.lbos.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import com.cbg.lbos.entity.AssignmentStatus;
import com.cbg.lbos.entity.LocationManager;
import com.cbg.lbos.entity.OperationsManager;
import com.cbg.lbos.entity.UserAccount;
import com.cbg.lbos.entity.Zone;
import com.cbg.lbos.exception.ConflictException;
import com.cbg.lbos.repository.LocationManagerRepository;
import com.cbg.lbos.repository.OperationsManagerRepository;
import com.cbg.lbos.repository.UserAccountRepository;

/**
 * A Location Manager's account status (what the admin Accounts page lists) and assignment status (what the Operations
 * Manager's Location managers page lists) always move together, whichever side is changed.
 */
@ExtendWith(MockitoExtension.class)
class LocationManagerAccountStatusSyncTest {

    @Mock OperationsManagerRepository operationsManagerRepository;
    @Mock UserAccountRepository userAccountRepository;
    @Mock LocationManagerRepository locationManagerRepository;

    private OperationsManagerStatusSync sync;
    private UserAccount account;
    private LocationManager assignment;
    private OperationsManager supervisor;
    private Zone zone;

    @BeforeEach
    void setUp() {
        sync = new OperationsManagerStatusSync(operationsManagerRepository, userAccountRepository, locationManagerRepository);
        account = new UserAccount();
        ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
        zone = new Zone();
        zone.setIsActive(true);
        supervisor = new OperationsManager();
        supervisor.setAssignmentStatus(AssignmentStatus.ACTIVE);
        assignment = new LocationManager();
        assignment.setUserAccount(account);
        assignment.setZone(zone);
        assignment.setOperationsManager(supervisor);
        lenient().when(operationsManagerRepository.findByUserAccountId(account.getId())).thenReturn(Optional.empty());
        lenient().when(locationManagerRepository.findFirstByUserAccountIdOrderByAssignedAtDesc(account.getId()))
                .thenReturn(Optional.of(assignment));
    }

    @Test
    void deactivatingTheAssignmentDeactivatesTheAccountAndActivatingItSwitchesItBackOn() {
        account.setAccountStatus("ACTIVE");
        assignment.setAssignmentStatus(AssignmentStatus.INACTIVE);
        sync.locationManagerAssignmentChanged(assignment);
        assertEquals("INACTIVE", account.getAccountStatus());

        assignment.setAssignmentStatus(AssignmentStatus.ACTIVE);
        sync.locationManagerAssignmentChanged(assignment);
        assertEquals("ACTIVE", account.getAccountStatus());
    }

    @Test
    void aTransferredAssignmentAndAnUnverifiedAccountAreLeftAlone() {
        assignment.setAssignmentStatus(AssignmentStatus.TRANSFERRED);
        account.setAccountStatus("ACTIVE");
        sync.locationManagerAssignmentChanged(assignment);
        assertEquals("ACTIVE", account.getAccountStatus());

        assignment.setAssignmentStatus(AssignmentStatus.INACTIVE);
        account.setAccountStatus("PENDING_VERIFICATION");
        sync.locationManagerAssignmentChanged(assignment);
        assertEquals("PENDING_VERIFICATION", account.getAccountStatus());
    }

    @Test
    void deactivatingTheAccountOnTheAccountsPageDeactivatesTheAssignment() {
        assignment.setAssignmentStatus(AssignmentStatus.ACTIVE);
        account.setAccountStatus("INACTIVE");

        sync.accountStatusChanged(account);

        assertEquals(AssignmentStatus.INACTIVE, assignment.getAssignmentStatus());
        verify(locationManagerRepository).save(assignment);
    }

    @Test
    void suspendingTheAccountSuspendsTheAssignment() {
        assignment.setAssignmentStatus(AssignmentStatus.ACTIVE);
        account.setAccountStatus("SUSPENDED");

        sync.accountStatusChanged(account);

        assertEquals(AssignmentStatus.SUSPENDED, assignment.getAssignmentStatus());
    }

    @Test
    void reactivatingTheAccountReactivatesTheAssignmentWhenItsZoneAndSupervisorAreActive() {
        assignment.setAssignmentStatus(AssignmentStatus.INACTIVE);
        account.setAccountStatus("ACTIVE");

        sync.accountStatusChanged(account);

        assertEquals(AssignmentStatus.ACTIVE, assignment.getAssignmentStatus());
    }

    @Test
    void reactivatingIsRefusedWhenTheSupervisingOperationsManagerIsNotActive() {
        assignment.setAssignmentStatus(AssignmentStatus.INACTIVE);
        supervisor.setAssignmentStatus(AssignmentStatus.INACTIVE);
        account.setAccountStatus("ACTIVE");

        assertThrows(ConflictException.class, () -> sync.accountStatusChanged(account));

        assertEquals(AssignmentStatus.INACTIVE, assignment.getAssignmentStatus());
        verify(locationManagerRepository, never()).save(assignment);
    }
}
