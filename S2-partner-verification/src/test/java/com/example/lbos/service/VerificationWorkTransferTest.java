package com.example.lbos.service;

import com.example.lbos.client.LocationManagerClient;
import com.example.lbos.client.LocationManagerClient.LocationManagerSummary;
import com.example.lbos.client.NotificationClient;
import com.example.lbos.dto.PendingWorkItemDTO;
import com.example.lbos.dto.TransferWorkRequestDTO;
import com.example.lbos.dto.TransferWorkResultDTO;
import com.example.lbos.dto.VerificationQueueDTO;
import com.example.lbos.entity.Retailer;
import com.example.lbos.entity.VerificationQueue;
import com.example.lbos.exception.ForbiddenActionException;
import com.example.lbos.exception.InvalidVerificationTransitionException;
import com.example.lbos.repository.FleetOwnerRepository;
import com.example.lbos.repository.RetailerRepository;
import com.example.lbos.repository.VerificationQueueRepository;
import com.example.lbos.security.ZoneScope;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** CR 11 - pending work of a Location Manager and its transfer to another one. */
@ExtendWith(MockitoExtension.class)
class VerificationWorkTransferTest {

    @Mock private VerificationQueueRepository queues;
    @Mock private RetailerRepository retailers;
    @Mock private FleetOwnerRepository fleetOwners;
    @Mock private LocationManagerClient locationManagers;
    @Mock private NotificationClient notifications;
    @InjectMocks private VerificationQueueServiceImpl service;

    private final UUID stateId = UUID.randomUUID();
    private final UUID northZone = UUID.randomUUID();
    private final UUID fromAccount = UUID.randomUUID();
    private final UUID toAccount = UUID.randomUUID();
    private final UUID operationsManagerAccount = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private LocationManagerSummary manager(UUID account, UUID zone, String zoneName, String status, UUID state) {
        return new LocationManagerSummary(UUID.randomUUID(), account, "Jo", account == fromAccount ? "From" : "To",
                "x@x.com", zone, zoneName, UUID.randomUUID(), "Chennai", state, operationsManagerAccount, status);
    }

    @BeforeEach
    void managers() {
        lenient().when(locationManagers.getByUser(fromAccount)).thenReturn(manager(fromAccount, northZone, "North", "ACTIVE", stateId));
        lenient().when(locationManagers.getByUser(toAccount)).thenReturn(manager(toAccount, UUID.randomUUID(), "South", "ACTIVE", stateId));
    }

    private VerificationQueue pending(UUID reviewer, UUID zone, String status) {
        VerificationQueue queue = new VerificationQueue();
        queue.setVerificationQueueId(UUID.randomUUID());
        queue.setSubjectType("RETAILER");
        queue.setSubjectId(UUID.randomUUID());
        queue.setSubmittedByAccountId(UUID.randomUUID());
        queue.setZoneId(zone);
        queue.setIsActive(true);
        queue.setVerificationStatus(status);
        queue.setReviewedByAccountId(reviewer);
        queue.setCreatedAt(OffsetDateTime.now());
        return queue;
    }

    private void signInAs(UUID account, String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                account.toString(), null, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    // ------------------------------------------------------------------ the definition of pending work

    @Test
    void pendingWorkIsWhatIsAssignedToTheOfficerOrUnassignedInTheirZone() {
        assertTrue(VerificationWork.isPendingFor(pending(fromAccount, UUID.randomUUID(), "SENT_TO_LOCATION_MANAGER"), fromAccount, northZone));
        assertTrue(VerificationWork.isPendingFor(pending(null, northZone, "SENT_TO_LOCATION_MANAGER"), fromAccount, northZone));
        assertTrue(VerificationWork.isPendingFor(pending(null, northZone, "RESUBMISSION_REQUIRED"), fromAccount, northZone));
        // handed to someone else, decided, not yet with the Location Manager, or another zone: not this officer's pending work
        assertFalse(VerificationWork.isPendingFor(pending(toAccount, northZone, "SENT_TO_LOCATION_MANAGER"), fromAccount, northZone));
        assertFalse(VerificationWork.isPendingFor(pending(null, northZone, "APPROVED"), fromAccount, northZone));
        assertFalse(VerificationWork.isPendingFor(pending(null, northZone, "DOCUMENTS_SUBMITTED"), fromAccount, northZone));
        assertFalse(VerificationWork.isPendingFor(pending(null, UUID.randomUUID(), "SENT_TO_LOCATION_MANAGER"), fromAccount, northZone));
    }

    @Test
    void thePopupListsThePendingRequestsByPartnerName() {
        VerificationQueue first = pending(null, northZone, "SENT_TO_LOCATION_MANAGER");
        when(queues.findPendingWork(eq(fromAccount), eq(northZone), anyCollection())).thenReturn(List.of(first));
        Retailer freshMart = new Retailer();
        freshMart.setRetailerId(first.getSubjectId());
        freshMart.setBusinessName("Fresh Mart");
        when(retailers.findAllById(any())).thenReturn(List.of(freshMart));

        List<PendingWorkItemDTO> items = service.getPendingWork(fromAccount);

        assertEquals(1, items.size());
        assertEquals("Fresh Mart", items.get(0).subjectName());
        assertEquals("RETAILER", items.get(0).subjectType());
        assertEquals(first.getVerificationQueueId(), items.get(0).verificationQueueId());
    }

    // ------------------------------------------------------------------ transferring it

    @Test
    void aPartialTransferMovesOnlyTheSelectedRequestsAndReportsWhatIsLeft() {
        VerificationQueue one = pending(null, northZone, "SENT_TO_LOCATION_MANAGER");
        VerificationQueue two = pending(fromAccount, northZone, "RESUBMISSION_REQUIRED");
        when(queues.findAllById(any())).thenReturn(List.of(one, two));
        when(queues.countPendingWork(eq(fromAccount), eq(northZone), anyCollection())).thenReturn(3L);

        TransferWorkResultDTO result = service.transferWork(new TransferWorkRequestDTO(
                fromAccount, toAccount, List.of(one.getVerificationQueueId(), two.getVerificationQueueId())));

        assertEquals(List.of(one.getVerificationQueueId(), two.getVerificationQueueId()), result.transferred());
        assertTrue(result.failed().isEmpty());
        assertEquals(3L, result.remainingPending(), "the original action stays blocked while anything remains");
        assertEquals(toAccount, one.getReviewedByAccountId());
        assertEquals(toAccount, two.getReviewedByAccountId());
        verify(queues, times(2)).save(any(VerificationQueue.class));
    }

    @Test
    void aRequestThatCannotMoveStaysPutWhileTheOthersStillMove() {
        VerificationQueue movable = pending(null, northZone, "SENT_TO_LOCATION_MANAGER");
        VerificationQueue alreadyDecided = pending(null, northZone, "APPROVED");
        VerificationQueue ownSubmission = pending(null, northZone, "SENT_TO_LOCATION_MANAGER");
        ownSubmission.setSubmittedByAccountId(toAccount);
        UUID gone = UUID.randomUUID();
        when(queues.findAllById(any())).thenReturn(List.of(movable, alreadyDecided, ownSubmission));
        when(queues.countPendingWork(eq(fromAccount), eq(northZone), anyCollection())).thenReturn(1L);

        TransferWorkResultDTO result = service.transferWork(new TransferWorkRequestDTO(fromAccount, toAccount,
                List.of(movable.getVerificationQueueId(), alreadyDecided.getVerificationQueueId(),
                        ownSubmission.getVerificationQueueId(), gone)));

        assertEquals(List.of(movable.getVerificationQueueId()), result.transferred());
        assertEquals(3, result.failed().size());
        assertNull(alreadyDecided.getReviewedByAccountId());
        assertNull(ownSubmission.getReviewedByAccountId());
        verify(queues, times(1)).save(any(VerificationQueue.class));
    }

    @Test
    void theNewLocationManagerIsNotifiedOnceAfterATransfer() {
        VerificationQueue one = pending(null, northZone, "SENT_TO_LOCATION_MANAGER");
        VerificationQueue two = pending(null, northZone, "SENT_TO_LOCATION_MANAGER");
        when(queues.findAllById(any())).thenReturn(List.of(one, two));
        when(queues.countPendingWork(any(), any(), anyCollection())).thenReturn(0L);

        service.transferWork(new TransferWorkRequestDTO(fromAccount, toAccount,
                List.of(one.getVerificationQueueId(), two.getVerificationQueueId())));

        ArgumentCaptor<NotificationClient.NotificationCreateRequest> sent = ArgumentCaptor.forClass(NotificationClient.NotificationCreateRequest.class);
        verify(notifications, times(1)).create(sent.capture());
        assertEquals(toAccount, sent.getValue().userAccountId());
        assertEquals("LOCATION_MANAGER", sent.getValue().role());
        assertTrue(sent.getValue().message().startsWith("2 verification requests have been transferred to you from Jo From"));
    }

    @Test
    void nothingIsNotifiedWhenNothingMoved() {
        when(queues.findAllById(any())).thenReturn(List.of());
        when(queues.countPendingWork(any(), any(), anyCollection())).thenReturn(4L);

        TransferWorkResultDTO result = service.transferWork(new TransferWorkRequestDTO(fromAccount, toAccount, List.of(UUID.randomUUID())));

        assertTrue(result.transferred().isEmpty());
        assertEquals(4L, result.remainingPending());
        verifyNoInteractions(notifications);
    }

    // ------------------------------------------------------------------ who may receive it, who may do it

    @Test
    void workCannotBeTransferredToTheSameOfficerOrAnIneligibleOne() {
        assertThrows(InvalidVerificationTransitionException.class, () ->
                service.transferWork(new TransferWorkRequestDTO(fromAccount, fromAccount, List.of(UUID.randomUUID()))));

        when(locationManagers.getByUser(toAccount)).thenReturn(manager(toAccount, UUID.randomUUID(), "South", "INACTIVE", stateId));
        assertThrows(InvalidVerificationTransitionException.class, () ->
                service.transferWork(new TransferWorkRequestDTO(fromAccount, toAccount, List.of(UUID.randomUUID()))));

        when(locationManagers.getByUser(toAccount)).thenReturn(manager(toAccount, UUID.randomUUID(), "Other state", "ACTIVE", UUID.randomUUID()));
        assertThrows(InvalidVerificationTransitionException.class, () ->
                service.transferWork(new TransferWorkRequestDTO(fromAccount, toAccount, List.of(UUID.randomUUID()))));
        verify(queues, never()).save(any());
    }

    @Test
    void anOperationsManagerCanOnlyMoveWorkOfTheOfficersTheySupervise() {
        signInAs(UUID.randomUUID(), "OPERATIONS_MANAGER");
        assertThrows(ForbiddenActionException.class, () -> service.getPendingWork(fromAccount));
        assertThrows(ForbiddenActionException.class, () ->
                service.transferWork(new TransferWorkRequestDTO(fromAccount, toAccount, List.of(UUID.randomUUID()))));

        signInAs(operationsManagerAccount, "OPERATIONS_MANAGER");
        when(queues.findPendingWork(any(), any(), anyCollection())).thenReturn(List.of());
        assertTrue(service.getPendingWork(fromAccount).isEmpty());
    }

    // ------------------------------------------------------------------ what a Location Manager may see

    @Test
    void aLocationManagerSeesTheirZoneAndWhatWasAssignedToThemButNotWhatWasHandedAway() {
        VerificationQueueDTO inZone = dto(northZone, null, "SENT_TO_LOCATION_MANAGER", true);
        VerificationQueueDTO assignedIn = dto(UUID.randomUUID(), fromAccount, "SENT_TO_LOCATION_MANAGER", true);
        VerificationQueueDTO handedAway = dto(northZone, toAccount, "SENT_TO_LOCATION_MANAGER", true);
        VerificationQueueDTO decidedByOther = dto(northZone, toAccount, "APPROVED", false);
        VerificationQueueDTO otherZone = dto(UUID.randomUUID(), null, "SENT_TO_LOCATION_MANAGER", true);

        assertTrue(ZoneScope.canSee(inZone, fromAccount, northZone));
        assertTrue(ZoneScope.canSee(assignedIn, fromAccount, northZone));
        assertFalse(ZoneScope.canSee(handedAway, fromAccount, northZone));
        assertTrue(ZoneScope.canSee(decidedByOther, fromAccount, northZone), "a decided request stays in its zone's history");
        assertFalse(ZoneScope.canSee(otherZone, fromAccount, northZone));
    }

    private VerificationQueueDTO dto(UUID zone, UUID reviewer, String status, boolean active) {
        VerificationQueueDTO dto = new VerificationQueueDTO();
        dto.setZoneId(zone);
        dto.setReviewedByAccountId(reviewer);
        dto.setVerificationStatus(status);
        dto.setIsActive(active);
        return dto;
    }
}
