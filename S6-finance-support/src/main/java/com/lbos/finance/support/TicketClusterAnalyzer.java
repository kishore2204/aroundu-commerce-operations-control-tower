package com.lbos.finance.support;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.lbos.finance.entity.SupportTicket;

/**
 * The pure decision core of the ticket-clustering feature: given still-live tickets that have
 * already had a territory resolved for them, decide which (category, sub-category, territory)
 * groups constitute an incident.
 *
 * <p>Deliberately free of repositories, Feign clients and clocks so the grouping and threshold
 * rules - the part that actually decides whether a customer's low-priority complaint gets
 * escalated - can be unit tested directly. The sweep service
 * ({@code TicketClusterServiceImpl}) owns the I/O around it.</p>
 */
public final class TicketClusterAnalyzer {

    /**
     * Three DISTINCT raisers, not three tickets. One frustrated customer re-raising the same
     * complaint three times is a duplicate-ticket problem, not a zone-wide outage, and must not
     * trip an incident; three different people hitting the same thing in the same zone is a
     * pattern no single ticket's priority can express. Two was rejected as too noisy for a
     * platform where any two neighbours can independently have a bad delivery day.
     */
    public static final int MIN_DISTINCT_RAISERS = 3;

    /**
     * Placeholder stored in place of a null sub-category, so the cluster key stays a plain
     * comparable triple (and the incident lookup stays a plain equality query) rather than
     * needing null-aware handling at every layer.
     */
    public static final String NO_SUB_CATEGORY = "-";

    private TicketClusterAnalyzer() { }

    /**
     * A ticket paired with the territory resolved for it.
     *
     * @param ticket the ticket
     * @param territoryKey the resolved territory key ("ZONE:&lt;uuid&gt;" or "CITY:&lt;uuid&gt;")
     * @param cityId the resolved city id, if known
     * @param zoneId the resolved zone id, if known
     */
    public record LocatedTicket(SupportTicket ticket, String territoryKey, UUID cityId, UUID zoneId) { }

    /**
     * The identity of a cluster: the same complaint, in the same place.
     *
     * @param ticketCategory the shared ticket category
     * @param ticketSubCategory the shared sub-category, or {@link #NO_SUB_CATEGORY}
     * @param territoryKey the shared territory key
     */
    public record ClusterKey(String ticketCategory, String ticketSubCategory, String territoryKey) { }

    /**
     * A group that met the threshold and should become (or refresh) an incident.
     *
     * @param key the cluster identity
     * @param cityId the city the cluster sits in, if known
     * @param zoneId the zone the cluster sits in, if known
     * @param tickets the clustered tickets, oldest first
     * @param distinctRaisers how many distinct accounts raised them
     * @param firstSeenAt the earliest raisedAt in the cluster
     * @param lastSeenAt the latest raisedAt in the cluster
     */
    public record DetectedCluster(ClusterKey key, UUID cityId, UUID zoneId, List<SupportTicket> tickets,
            int distinctRaisers, OffsetDateTime firstSeenAt, OffsetDateTime lastSeenAt) { }

    /**
     * Groups the located tickets by (category, sub-category, territory) and returns only the
     * groups raised by at least {@link #MIN_DISTINCT_RAISERS} distinct accounts.
     *
     * <p>Tickets with no resolved territory, no category, or no raisedAt are skipped: without a
     * place there is no "same zone" claim to make, and grouping them all under a synthetic
     * "unknown" bucket would manufacture incidents out of unrelated complaints.</p>
     *
     * @param locatedTickets the still-live tickets in the window, each with a resolved territory
     * @return the clusters that met the threshold, largest first
     */
    public static List<DetectedCluster> detectClusters(List<LocatedTicket> locatedTickets) {
        Map<ClusterKey, List<LocatedTicket>> grouped = new LinkedHashMap<>();
        for (LocatedTicket located : locatedTickets) {
            SupportTicket ticket = located.ticket();
            if (located.territoryKey() == null || ticket.getTicketCategory() == null
                    || ticket.getRaisedAt() == null || ticket.getRaisedByAccountId() == null) {
                continue;
            }
            String subCategory = ticket.getTicketSubCategory() == null
                    ? NO_SUB_CATEGORY : ticket.getTicketSubCategory();
            ClusterKey key = new ClusterKey(ticket.getTicketCategory(), subCategory, located.territoryKey());
            grouped.computeIfAbsent(key, k -> new ArrayList<>()).add(located);
        }

        List<DetectedCluster> clusters = new ArrayList<>();
        for (Map.Entry<ClusterKey, List<LocatedTicket>> entry : grouped.entrySet()) {
            List<LocatedTicket> members = entry.getValue();
            Set<UUID> raisers = new HashSet<>();
            for (LocatedTicket member : members) {
                raisers.add(member.ticket().getRaisedByAccountId());
            }
            if (raisers.size() < MIN_DISTINCT_RAISERS) continue;

            List<SupportTicket> tickets = members.stream()
                    .map(LocatedTicket::ticket)
                    .sorted(Comparator.comparing(SupportTicket::getRaisedAt))
                    .toList();
            clusters.add(new DetectedCluster(
                    entry.getKey(),
                    members.get(0).cityId(),
                    members.get(0).zoneId(),
                    tickets,
                    raisers.size(),
                    tickets.get(0).getRaisedAt(),
                    tickets.get(tickets.size() - 1).getRaisedAt()));
        }
        clusters.sort(Comparator.comparingInt((DetectedCluster c) -> c.tickets().size()).reversed());
        return clusters;
    }

    /**
     * Builds the territory key for a resolved city/zone pair. Zone is preferred because it is
     * the tighter, more actionable unit ("this zone's deliveries are broken"); a city-level key
     * is the fallback for addresses that carry a city but no assigned zone, which is better than
     * dropping those tickets entirely.
     *
     * @param cityId the resolved city id, may be {@code null}
     * @param zoneId the resolved zone id, may be {@code null}
     * @return the territory key, or {@code null} if neither id is known
     */
    public static String territoryKey(UUID cityId, UUID zoneId) {
        if (zoneId != null) return "ZONE:" + zoneId;
        if (cityId != null) return "CITY:" + cityId;
        return null;
    }
}
