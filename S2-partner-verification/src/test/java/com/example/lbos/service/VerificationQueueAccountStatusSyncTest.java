package com.example.lbos.service;

import com.example.lbos.client.AccountLookupClient;
import com.example.lbos.entity.FleetOwner;
import com.example.lbos.entity.Retailer;
import com.example.lbos.entity.VerificationQueue;
import com.example.lbos.repository.FleetOwnerRepository;
import com.example.lbos.repository.RetailerRepository;
import com.example.lbos.repository.VerificationQueueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression tests for the "Location Manager blocked a retailer / fleet owner but the admin Accounts page still shows the account
 * ACTIVE" defect: the block only changed the S2 partner record, never the S1 user account the Accounts page lists.
 */
@ExtendWith(MockitoExtension.class)
class VerificationQueueAccountStatusSyncTest {

    @Mock private VerificationQueueRepository repository;
    @Mock private RetailerRepository retailerRepository;
    @Mock private FleetOwnerRepository fleetOwnerRepository;
    @Mock private AccountLookupClient accountClient;
    @InjectMocks private VerificationQueueServiceImpl service;

    private final UUID queueId = UUID.randomUUID();
    private final UUID subjectId = UUID.randomUUID();
    private final UUID userAccountId = UUID.randomUUID();
    private VerificationQueue queue;

    @BeforeEach
    void approvedQueue() {
        queue = new VerificationQueue();
        queue.setVerificationQueueId(queueId);
        queue.setSubjectId(subjectId);
        queue.setVerificationStatus("APPROVED");
        queue.setCreatedAt(OffsetDateTime.now());
        queue.setUpdatedAt(OffsetDateTime.now());
        when(repository.findById(queueId)).thenReturn(Optional.of(queue));
    }

    @Test
    void revokingARetailerSuspendsTheirUserAccountToo() {
        queue.setSubjectType("RETAILER");
        Retailer retailer = new Retailer();
        retailer.setRetailerId(subjectId);
        retailer.setUserAccountId(userAccountId);
        when(retailerRepository.findById(subjectId)).thenReturn(Optional.of(retailer));

        service.revokeApproval(queueId, "documents were forged");

        verify(accountClient).updateStatus(userAccountId, Map.of("accountStatus", "SUSPENDED"));
    }

    @Test
    void revokingAFleetOwnerSuspendsTheirUserAccountToo() {
        queue.setSubjectType("FLEET_OWNER");
        FleetOwner owner = new FleetOwner();
        owner.setFleetOwnerId(subjectId);
        owner.setUserAccountId(userAccountId);
        when(fleetOwnerRepository.findById(subjectId)).thenReturn(Optional.of(owner));

        service.revokeApproval(queueId, "licence lapsed");

        verify(accountClient).updateStatus(userAccountId, Map.of("accountStatus", "SUSPENDED"));
    }

    @Test
    void anAccountServiceOutageNeverFailsTheBlockItself() {
        queue.setSubjectType("RETAILER");
        Retailer retailer = new Retailer();
        retailer.setRetailerId(subjectId);
        retailer.setUserAccountId(userAccountId);
        when(retailerRepository.findById(subjectId)).thenReturn(Optional.of(retailer));
        when(accountClient.updateStatus(any(), any())).thenThrow(new RuntimeException("S1 unreachable"));

        service.revokeApproval(queueId, "reason");

        verify(retailerRepository).save(retailer);
    }

    @Test
    void aRetailerWithoutAnAccountIdIsNotSynced() {
        queue.setSubjectType("RETAILER");
        Retailer retailer = new Retailer();
        retailer.setRetailerId(subjectId);
        when(retailerRepository.findById(subjectId)).thenReturn(Optional.of(retailer));

        service.revokeApproval(queueId, "reason");

        verify(accountClient, never()).updateStatus(any(), any());
    }
}
