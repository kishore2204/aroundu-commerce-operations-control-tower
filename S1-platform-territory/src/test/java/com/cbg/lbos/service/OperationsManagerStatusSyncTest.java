package com.cbg.lbos.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import com.cbg.lbos.entity.AssignmentStatus;
import com.cbg.lbos.entity.City;
import com.cbg.lbos.entity.OperationsManager;
import com.cbg.lbos.entity.UserAccount;
import com.cbg.lbos.exception.ConflictException;
import com.cbg.lbos.repository.OperationsManagerRepository;
import com.cbg.lbos.repository.UserAccountRepository;

@ExtendWith(MockitoExtension.class)
class OperationsManagerStatusSyncTest {

    @Mock OperationsManagerRepository operationsManagerRepository;
    @Mock UserAccountRepository userAccountRepository;

    private OperationsManagerStatusSync sync;
    private UserAccount account;
    private OperationsManager assignment;
    private UUID cityId;

    @BeforeEach
    void setUp() {
        sync = new OperationsManagerStatusSync(operationsManagerRepository, userAccountRepository);
        cityId = UUID.randomUUID();
        account = new UserAccount();
        ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
        City city = new City();
        city.setId(cityId);
        assignment = new OperationsManager();
        ReflectionTestUtils.setField(assignment, "id", UUID.randomUUID());
        assignment.setUserAccount(account);
        assignment.setCity(city);
    }

    private void accountHasAssignment() {
        when(operationsManagerRepository.findByUserAccountId(account.getId())).thenReturn(Optional.of(assignment));
    }

    @Test
    void deactivatingTheAccountDeactivatesTheActiveAssignment() {
        account.setAccountStatus("INACTIVE");
        assignment.setAssignmentStatus(AssignmentStatus.ACTIVE);
        accountHasAssignment();

        sync.accountStatusChanged(account);

        assertEquals(AssignmentStatus.INACTIVE, assignment.getAssignmentStatus());
        verify(operationsManagerRepository).save(assignment);
    }

    @Test
    void activatingTheAccountActivatesTheInactiveAssignment() {
        account.setAccountStatus("ACTIVE");
        assignment.setAssignmentStatus(AssignmentStatus.INACTIVE);
        accountHasAssignment();
        when(operationsManagerRepository.findFirstByCityIdAndAssignmentStatus(cityId, AssignmentStatus.ACTIVE)).thenReturn(Optional.empty());

        sync.accountStatusChanged(account);

        assertEquals(AssignmentStatus.ACTIVE, assignment.getAssignmentStatus());
    }

    @Test
    void activatingTheAccountIsRejectedWhenAnotherManagerAlreadyHoldsTheCity() {
        account.setAccountStatus("ACTIVE");
        assignment.setAssignmentStatus(AssignmentStatus.INACTIVE);
        accountHasAssignment();
        OperationsManager other = new OperationsManager();
        ReflectionTestUtils.setField(other, "id", UUID.randomUUID());
        when(operationsManagerRepository.findFirstByCityIdAndAssignmentStatus(cityId, AssignmentStatus.ACTIVE)).thenReturn(Optional.of(other));

        assertThrows(ConflictException.class, () -> sync.accountStatusChanged(account));
        assertEquals(AssignmentStatus.INACTIVE, assignment.getAssignmentStatus());
    }

    @Test
    void suspendingTheAccountSuspendsTheAssignmentAndActivatingItBringsItBack() {
        assignment.setAssignmentStatus(AssignmentStatus.ACTIVE);
        accountHasAssignment();

        account.setAccountStatus("SUSPENDED");
        sync.accountStatusChanged(account);
        assertEquals(AssignmentStatus.SUSPENDED, assignment.getAssignmentStatus());

        account.setAccountStatus("ACTIVE");
        when(operationsManagerRepository.findFirstByCityIdAndAssignmentStatus(cityId, AssignmentStatus.ACTIVE)).thenReturn(Optional.empty());
        sync.accountStatusChanged(account);
        assertEquals(AssignmentStatus.ACTIVE, assignment.getAssignmentStatus());
    }

    @Test
    void deactivatingTheAccountOfASuspendedManagerDeactivatesTheAssignment() {
        assignment.setAssignmentStatus(AssignmentStatus.SUSPENDED);
        account.setAccountStatus("INACTIVE");
        accountHasAssignment();

        sync.accountStatusChanged(account);

        assertEquals(AssignmentStatus.INACTIVE, assignment.getAssignmentStatus());
    }

    @Test
    void aTransferredAssignmentIsNeverOverwrittenByAnAccountChange() {
        assignment.setAssignmentStatus(AssignmentStatus.TRANSFERRED);
        accountHasAssignment();
        for (String status : new String[] {"ACTIVE", "INACTIVE", "SUSPENDED"}) {
            account.setAccountStatus(status);
            sync.accountStatusChanged(account);
            assertEquals(AssignmentStatus.TRANSFERRED, assignment.getAssignmentStatus());
        }
        verify(operationsManagerRepository, never()).save(any());
    }

    @Test
    void anAccountWithoutAnAssignmentIsLeftAlone() {
        account.setAccountStatus("SUSPENDED");
        when(operationsManagerRepository.findByUserAccountId(account.getId())).thenReturn(Optional.empty());

        sync.accountStatusChanged(account);

        verify(operationsManagerRepository, never()).save(any());
    }

    @Test
    void assignmentChangesAreMirroredOntoTheAccountWithSuspendedKeptDistinctFromInactive() {
        account.setAccountStatus("ACTIVE");

        assignment.setAssignmentStatus(AssignmentStatus.INACTIVE);
        sync.assignmentStatusChanged(assignment);
        assertEquals("INACTIVE", account.getAccountStatus());

        assignment.setAssignmentStatus(AssignmentStatus.ACTIVE);
        sync.assignmentStatusChanged(assignment);
        assertEquals("ACTIVE", account.getAccountStatus());

        assignment.setAssignmentStatus(AssignmentStatus.SUSPENDED);
        sync.assignmentStatusChanged(assignment);
        assertEquals("SUSPENDED", account.getAccountStatus());

        assignment.setAssignmentStatus(AssignmentStatus.INACTIVE);
        sync.assignmentStatusChanged(assignment);
        assertEquals("INACTIVE", account.getAccountStatus());
    }

    @Test
    void aTransferredAssignmentDoesNotChangeTheAccountAndAnUnverifiedAccountIsLeftAlone() {
        assignment.setAssignmentStatus(AssignmentStatus.TRANSFERRED);
        account.setAccountStatus("ACTIVE");
        sync.assignmentStatusChanged(assignment);
        assertEquals("ACTIVE", account.getAccountStatus());

        assignment.setAssignmentStatus(AssignmentStatus.SUSPENDED);
        account.setAccountStatus("PENDING_VERIFICATION");
        sync.assignmentStatusChanged(assignment);
        assertEquals("PENDING_VERIFICATION", account.getAccountStatus());
    }
}
