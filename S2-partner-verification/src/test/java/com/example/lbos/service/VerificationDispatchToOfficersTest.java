package com.example.lbos.service;

import com.example.lbos.client.LocationManagerClient;
import com.example.lbos.client.LocationManagerClient.ZoneLocationManager;
import com.example.lbos.entity.VerificationQueue;
import com.example.lbos.repository.FleetOwnerRepository;
import com.example.lbos.repository.RetailerRepository;
import com.example.lbos.repository.VerificationQueueRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** A zone can have several Location Managers: a newly submitted request goes to exactly one of them. */
@ExtendWith(MockitoExtension.class)
class VerificationDispatchToOfficersTest {

    @Mock private VerificationQueueRepository queues;
    @Mock private RetailerRepository retailers;
    @Mock private FleetOwnerRepository fleetOwners;
    @Mock private LocationManagerClient locationManagers;
    @InjectMocks private VerificationQueueServiceImpl service;

    private final UUID zone = UUID.randomUUID();
    private final ZoneLocationManager first = new ZoneLocationManager(UUID.randomUUID(), UUID.randomUUID(), zone);
    private final ZoneLocationManager second = new ZoneLocationManager(UUID.randomUUID(), UUID.randomUUID(), zone);

    private VerificationQueue submitted(UUID reviewer) {
        VerificationQueue queue = new VerificationQueue();
        queue.setVerificationQueueId(UUID.randomUUID());
        queue.setSubjectType("RETAILER");
        queue.setSubjectId(UUID.randomUUID());
        queue.setZoneId(zone);
        queue.setIsActive(true);
        queue.setVerificationStatus("SENT_TO_LOCATION_MANAGER");
        queue.setReviewedByAccountId(reviewer);
        queue.setCreatedAt(OffsetDateTime.now());
        return queue;
    }

    private void dispatch(VerificationQueue queue) {
        ReflectionTestUtils.invokeMethod(service, "dispatchToLocationManager", queue);
    }

    private void workOf(ZoneLocationManager officer, long pending) {
        when(queues.countPendingWork(eq(officer.userAccountId()), eq(zone), anyCollection())).thenReturn(pending);
    }

    @Test
    void aNewRequestGoesToTheOfficerWithTheLeastPendingWork() {
        when(locationManagers.getActiveLocationManagersByZone(zone)).thenReturn(List.of(first, second));
        workOf(first, 3);
        workOf(second, 1);
        VerificationQueue queue = submitted(null);

        dispatch(queue);

        assertEquals(second.userAccountId(), queue.getReviewedByAccountId());
        verify(queues).save(queue);
        verify(locationManagers).submitVerificationRequest(eq(second.locationManagerId()), any(Map.class));
        verify(locationManagers, never()).submitVerificationRequest(eq(first.locationManagerId()), any(Map.class));
    }

    @Test
    void aTieGoesToTheLongestServingOfficer() {
        when(locationManagers.getActiveLocationManagersByZone(zone)).thenReturn(List.of(first, second));
        workOf(first, 2);
        workOf(second, 2);
        VerificationQueue queue = submitted(null);

        dispatch(queue);

        assertEquals(first.userAccountId(), queue.getReviewedByAccountId());
    }

    @Test
    void aResubmissionStaysWithTheOfficerWhoAlreadyHasItEvenIfSomeoneElseIsLessBusy() {
        when(locationManagers.getActiveLocationManagersByZone(zone)).thenReturn(List.of(first, second));
        VerificationQueue queue = submitted(first.userAccountId());

        dispatch(queue);

        assertEquals(first.userAccountId(), queue.getReviewedByAccountId());
        verify(queues, never()).countPendingWork(any(), any(), anyCollection());
        verify(locationManagers).submitVerificationRequest(eq(first.locationManagerId()), any(Map.class));
    }

    @Test
    void aFormerReviewerWhoLeftTheZoneIsReplacedByAnActiveOfficer() {
        when(locationManagers.getActiveLocationManagersByZone(zone)).thenReturn(List.of(first));
        workOf(first, 0);
        VerificationQueue queue = submitted(UUID.randomUUID());

        dispatch(queue);

        assertEquals(first.userAccountId(), queue.getReviewedByAccountId());
    }

    @Test
    void aZoneWithoutAnyActiveOfficerLeavesTheRequestUnassignedAndSendsNothing() {
        when(locationManagers.getActiveLocationManagersByZone(zone)).thenReturn(List.of());
        VerificationQueue queue = submitted(null);

        dispatch(queue);

        assertNull(queue.getReviewedByAccountId());
        verify(queues, never()).save(any());
        verify(locationManagers, never()).submitVerificationRequest(any(), any());
    }
}
