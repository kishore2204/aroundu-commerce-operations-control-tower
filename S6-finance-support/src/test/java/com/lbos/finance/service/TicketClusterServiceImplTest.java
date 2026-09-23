package com.lbos.finance.service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.lbos.finance.dto.TicketClusterSweepSummary;
import com.lbos.finance.entity.SupportTicket;
import com.lbos.finance.entity.TicketClusterIncident;
import com.lbos.finance.integration.client.CustomerServiceClient;
import com.lbos.finance.integration.dto.CustomerServiceAreaResponse;
import com.lbos.finance.repository.SupportTicketMessageRepository;
import com.lbos.finance.repository.SupportTicketRepository;
import com.lbos.finance.repository.TicketClusterIncidentRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Covers the sweep's escalation behaviour on top of the pure grouping logic: that a detected
 * cluster raises its members' priority once, and that re-running the sweep over the same
 * already-linked tickets does not walk them up another tier.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TicketClusterServiceImplTest {

    @Mock
    private SupportTicketRepository supportTicketRepository;
    @Mock
    private TicketClusterIncidentRepository incidentRepository;
    @Mock
    private SupportTicketMessageRepository messageRepository;
    @Mock
    private CustomerServiceClient customerServiceClient;

    @InjectMocks
    private TicketClusterServiceImpl service;

    private final UUID cityId = UUID.randomUUID();
    private final UUID zoneId = UUID.randomUUID();
    private List<SupportTicket> tickets;

    private SupportTicket lowTicket(UUID customerProfileId) {
        SupportTicket t = new SupportTicket();
        t.setCustomerTicketId(UUID.randomUUID());
        t.setTicketNumber("TKT-" + UUID.randomUUID());
        t.setCustomerProfileId(customerProfileId);
        t.setRaisedByAccountId(UUID.randomUUID());
        t.setTicketCategory("DELIVERY");
        t.setTicketSubCategory("LATE_DELIVERY");
        t.setPriority("LOW");
        t.setTicketStatus("OPEN");
        t.setRaisedAt(OffsetDateTime.now().minusHours(3));
        return t;
    }

    @BeforeEach
    void setUp() {
        tickets = List.of(lowTicket(UUID.randomUUID()), lowTicket(UUID.randomUUID()), lowTicket(UUID.randomUUID()));
        when(supportTicketRepository.findByTicketStatusInAndRaisedAtAfter(anyList(), any())).thenReturn(tickets);
        when(customerServiceClient.getCustomerServiceArea(any()))
                .thenAnswer(inv -> new CustomerServiceAreaResponse(inv.getArgument(0), cityId, zoneId));
        when(incidentRepository.save(any(TicketClusterIncident.class))).thenAnswer(inv -> {
            TicketClusterIncident incident = inv.getArgument(0);
            if (incident.getClusterIncidentId() == null) incident.setClusterIncidentId(UUID.randomUUID());
            return incident;
        });
        when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(inv -> inv.getArgument(0));
        when(incidentRepository.findByIncidentStatusOrderByLastSeenAtDesc(anyString())).thenReturn(List.of());
    }

    @Test
    void clusteredLowPriorityTicketsAreBumpedAndLinkedToANewIncident() {
        when(incidentRepository.findByTicketCategoryAndTicketSubCategoryAndTerritoryKeyAndIncidentStatus(
                any(), any(), any(), eq("ACTIVE"))).thenReturn(Optional.empty());

        TicketClusterSweepSummary summary = service.detectClusters();

        assertEquals(3, summary.ticketsScanned());
        assertEquals(3, summary.ticketsWithResolvedTerritory());
        assertEquals(1, summary.clustersDetected());
        assertEquals(1, summary.incidentsOpened());
        assertEquals(3, summary.ticketsPriorityBumped());
        for (SupportTicket t : tickets) {
            assertEquals("MEDIUM", t.getPriority());
            assertNotNull(t.getClusterIncidentId());
            assertNotNull(t.getDueBy());
        }
    }

    @Test
    void reRunningOverAlreadyLinkedTicketsDoesNotBumpThemAgain() {
        UUID incidentId = UUID.randomUUID();
        TicketClusterIncident existing = new TicketClusterIncident();
        existing.setClusterIncidentId(incidentId);
        existing.setIncidentStatus("ACTIVE");
        existing.setTicketCategory("DELIVERY");
        existing.setTicketSubCategory("LATE_DELIVERY");
        existing.setTerritoryKey("ZONE:" + zoneId);
        when(incidentRepository.findByTicketCategoryAndTicketSubCategoryAndTerritoryKeyAndIncidentStatus(
                any(), any(), any(), eq("ACTIVE"))).thenReturn(Optional.of(existing));
        for (SupportTicket t : tickets) {
            t.setPriority("MEDIUM");
            t.setClusterIncidentId(incidentId);
        }

        TicketClusterSweepSummary summary = service.detectClusters();

        assertEquals(1, summary.incidentsUpdated());
        assertEquals(0, summary.incidentsOpened());
        assertEquals(0, summary.ticketsPriorityBumped());
        for (SupportTicket t : tickets) {
            assertEquals("MEDIUM", t.getPriority());
        }
    }

    @Test
    void ticketsWithoutACustomerProfileAreExcludedFromClustering() {
        List<SupportTicket> staffRaised = List.of(lowTicket(null), lowTicket(null), lowTicket(null));
        when(supportTicketRepository.findByTicketStatusInAndRaisedAtAfter(anyList(), any())).thenReturn(staffRaised);

        TicketClusterSweepSummary summary = service.detectClusters();

        assertEquals(3, summary.ticketsScanned());
        assertEquals(0, summary.ticketsWithResolvedTerritory());
        assertEquals(0, summary.clustersDetected());
        assertEquals(0, summary.ticketsPriorityBumped());
    }
}
