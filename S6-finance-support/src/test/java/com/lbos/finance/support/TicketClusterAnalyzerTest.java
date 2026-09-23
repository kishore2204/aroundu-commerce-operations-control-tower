package com.lbos.finance.support;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.lbos.finance.entity.SupportTicket;
import com.lbos.finance.support.TicketClusterAnalyzer.DetectedCluster;
import com.lbos.finance.support.TicketClusterAnalyzer.LocatedTicket;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Covers the grouping/threshold decision at the heart of ticket clustering - the part that
 * decides whether a set of individually-harmless low-priority tickets is actually one incident.
 */
class TicketClusterAnalyzerTest {

    private static final UUID ZONE_A = UUID.randomUUID();
    private static final UUID ZONE_B = UUID.randomUUID();
    private static final UUID CITY = UUID.randomUUID();

    private static final OffsetDateTime BASE = OffsetDateTime.parse("2026-01-01T10:00:00Z");

    private LocatedTicket ticket(String category, String subCategory, UUID zoneId, UUID raiser, int hourOffset) {
        SupportTicket t = new SupportTicket();
        t.setCustomerTicketId(UUID.randomUUID());
        t.setTicketCategory(category);
        t.setTicketSubCategory(subCategory);
        t.setRaisedByAccountId(raiser);
        t.setRaisedAt(BASE.plusHours(hourOffset));
        t.setPriority("LOW");
        t.setTicketStatus("OPEN");
        return new LocatedTicket(t, TicketClusterAnalyzer.territoryKey(CITY, zoneId), CITY, zoneId);
    }

    @Test
    void threeDistinctRaisersInSameZoneAndCategoryFormACluster() {
        List<DetectedCluster> clusters = TicketClusterAnalyzer.detectClusters(List.of(
                ticket("DELIVERY", "LATE_DELIVERY", ZONE_A, UUID.randomUUID(), 0),
                ticket("DELIVERY", "LATE_DELIVERY", ZONE_A, UUID.randomUUID(), 2),
                ticket("DELIVERY", "LATE_DELIVERY", ZONE_A, UUID.randomUUID(), 5)));

        assertEquals(1, clusters.size());
        DetectedCluster cluster = clusters.get(0);
        assertEquals(3, cluster.tickets().size());
        assertEquals(3, cluster.distinctRaisers());
        assertEquals("DELIVERY", cluster.key().ticketCategory());
        assertEquals("LATE_DELIVERY", cluster.key().ticketSubCategory());
        assertEquals("ZONE:" + ZONE_A, cluster.key().territoryKey());
        assertEquals(BASE, cluster.firstSeenAt());
        assertEquals(BASE.plusHours(5), cluster.lastSeenAt());
        assertEquals(ZONE_A, cluster.zoneId());
    }

    @Test
    void twoDistinctRaisersIsBelowThresholdAndNotAnIncident() {
        List<DetectedCluster> clusters = TicketClusterAnalyzer.detectClusters(List.of(
                ticket("DELIVERY", "LATE_DELIVERY", ZONE_A, UUID.randomUUID(), 0),
                ticket("DELIVERY", "LATE_DELIVERY", ZONE_A, UUID.randomUUID(), 1)));

        assertTrue(clusters.isEmpty());
    }

    @Test
    void oneRaiserFilingThreeTicketsIsNotACluster() {
        UUID sameRaiser = UUID.randomUUID();
        List<DetectedCluster> clusters = TicketClusterAnalyzer.detectClusters(List.of(
                ticket("DELIVERY", "LATE_DELIVERY", ZONE_A, sameRaiser, 0),
                ticket("DELIVERY", "LATE_DELIVERY", ZONE_A, sameRaiser, 1),
                ticket("DELIVERY", "LATE_DELIVERY", ZONE_A, sameRaiser, 2)));

        assertTrue(clusters.isEmpty());
    }

    @Test
    void sameComplaintSplitAcrossTwoZonesDoesNotCluster() {
        List<DetectedCluster> clusters = TicketClusterAnalyzer.detectClusters(List.of(
                ticket("DELIVERY", "LATE_DELIVERY", ZONE_A, UUID.randomUUID(), 0),
                ticket("DELIVERY", "LATE_DELIVERY", ZONE_A, UUID.randomUUID(), 1),
                ticket("DELIVERY", "LATE_DELIVERY", ZONE_B, UUID.randomUUID(), 2)));

        assertTrue(clusters.isEmpty());
    }

    @Test
    void differentSubCategoriesInSameZoneAreSeparateGroups() {
        List<DetectedCluster> clusters = TicketClusterAnalyzer.detectClusters(List.of(
                ticket("DELIVERY", "LATE_DELIVERY", ZONE_A, UUID.randomUUID(), 0),
                ticket("DELIVERY", "LATE_DELIVERY", ZONE_A, UUID.randomUUID(), 1),
                ticket("DELIVERY", "ITEM_DAMAGED", ZONE_A, UUID.randomUUID(), 2)));

        assertTrue(clusters.isEmpty());
    }

    @Test
    void ticketsWithNoResolvedTerritoryAreExcluded() {
        SupportTicket unlocated = new SupportTicket();
        unlocated.setCustomerTicketId(UUID.randomUUID());
        unlocated.setTicketCategory("DELIVERY");
        unlocated.setTicketSubCategory("LATE_DELIVERY");
        unlocated.setRaisedByAccountId(UUID.randomUUID());
        unlocated.setRaisedAt(BASE);

        List<DetectedCluster> clusters = TicketClusterAnalyzer.detectClusters(List.of(
                ticket("DELIVERY", "LATE_DELIVERY", ZONE_A, UUID.randomUUID(), 0),
                ticket("DELIVERY", "LATE_DELIVERY", ZONE_A, UUID.randomUUID(), 1),
                new LocatedTicket(unlocated, null, null, null)));

        assertTrue(clusters.isEmpty());
    }

    @Test
    void nullSubCategoryIsNormalisedSoThoseTicketsStillGroup() {
        List<DetectedCluster> clusters = TicketClusterAnalyzer.detectClusters(List.of(
                ticket("PAYMENT", null, ZONE_A, UUID.randomUUID(), 0),
                ticket("PAYMENT", null, ZONE_A, UUID.randomUUID(), 1),
                ticket("PAYMENT", null, ZONE_A, UUID.randomUUID(), 2)));

        assertEquals(1, clusters.size());
        assertEquals(TicketClusterAnalyzer.NO_SUB_CATEGORY, clusters.get(0).key().ticketSubCategory());
    }

    @Test
    void largestClusterIsReturnedFirst() {
        List<DetectedCluster> clusters = TicketClusterAnalyzer.detectClusters(List.of(
                ticket("PAYMENT", "REFUND_DELAY", ZONE_B, UUID.randomUUID(), 0),
                ticket("PAYMENT", "REFUND_DELAY", ZONE_B, UUID.randomUUID(), 1),
                ticket("PAYMENT", "REFUND_DELAY", ZONE_B, UUID.randomUUID(), 2),
                ticket("DELIVERY", "LATE_DELIVERY", ZONE_A, UUID.randomUUID(), 0),
                ticket("DELIVERY", "LATE_DELIVERY", ZONE_A, UUID.randomUUID(), 1),
                ticket("DELIVERY", "LATE_DELIVERY", ZONE_A, UUID.randomUUID(), 2),
                ticket("DELIVERY", "LATE_DELIVERY", ZONE_A, UUID.randomUUID(), 3)));

        assertEquals(2, clusters.size());
        assertEquals(4, clusters.get(0).tickets().size());
        assertEquals("ZONE:" + ZONE_A, clusters.get(0).key().territoryKey());
    }

    @Test
    void territoryKeyPrefersZoneAndFallsBackToCity() {
        assertEquals("ZONE:" + ZONE_A, TicketClusterAnalyzer.territoryKey(CITY, ZONE_A));
        assertEquals("CITY:" + CITY, TicketClusterAnalyzer.territoryKey(CITY, null));
        assertNull(TicketClusterAnalyzer.territoryKey(null, null));
    }
}
