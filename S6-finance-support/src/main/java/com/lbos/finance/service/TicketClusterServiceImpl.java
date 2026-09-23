package com.lbos.finance.service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lbos.finance.dto.TicketClusterIncidentView;
import com.lbos.finance.dto.TicketClusterSweepSummary;
import com.lbos.finance.entity.SupportTicket;
import com.lbos.finance.entity.SupportTicketMessage;
import com.lbos.finance.entity.TicketClusterIncident;
import com.lbos.finance.exception.ResourceNotFoundException;
import com.lbos.finance.integration.client.CustomerServiceClient;
import com.lbos.finance.integration.dto.CustomerServiceAreaResponse;
import com.lbos.finance.repository.SupportTicketMessageRepository;
import com.lbos.finance.repository.SupportTicketRepository;
import com.lbos.finance.repository.TicketClusterIncidentRepository;
import com.lbos.finance.support.TicketClusterAnalyzer;
import com.lbos.finance.support.TicketClusterAnalyzer.DetectedCluster;
import com.lbos.finance.support.TicketClusterAnalyzer.LocatedTicket;

/**
 * Detects zone-level support-ticket clusters and escalates them.
 *
 * <p>Priority tier/SLA constants are intentionally re-stated here rather than shared with
 * {@code SupportTicketServiceImpl}: that class keeps them private to its SLA sweep, and the two
 * escalation reasons (time elapsed vs. many-people-same-place) are independent policies that
 * should be free to diverge. They currently agree - LOW-&gt;MEDIUM-&gt;HIGH, 72h/24h/4h.</p>
 */
@Service
@Transactional
public class TicketClusterServiceImpl implements TicketClusterService {

    private static final Logger log = LoggerFactory.getLogger(TicketClusterServiceImpl.class);

    /**
     * Rolling detection window. 48 hours is one full LOW-priority SLA cycle short of the 72h
     * LOW threshold, so a cluster of LOW tickets is caught and escalated BEFORE any of them
     * would have breached SLA on their own - which is the whole point of the feature. It is
     * also short enough that a problem fixed yesterday stops counting toward today's incident.
     */
    private static final int WINDOW_HOURS = 48;

    /** Only still-live tickets can form an incident; RESOLVED/CLOSED ones are history. */
    private static final List<String> LIVE_STATUSES = List.of("OPEN", "IN_PROGRESS");

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_RESOLVED = "RESOLVED";

    private final SupportTicketRepository supportTicketRepository;
    private final TicketClusterIncidentRepository incidentRepository;
    private final SupportTicketMessageRepository messageRepository;
    private final CustomerServiceClient customerServiceClient;

    /**
     * Creates the service with the repositories and the commerce client used to resolve a
     * ticket's territory.
     *
     * @param supportTicketRepository repository of support tickets
     * @param incidentRepository repository of cluster incident records
     * @param messageRepository repository used to leave the internal audit note on a ticket
     * @param customerServiceClient client used to resolve a customer's city/zone
     */
    public TicketClusterServiceImpl(SupportTicketRepository supportTicketRepository,
            TicketClusterIncidentRepository incidentRepository,
            SupportTicketMessageRepository messageRepository,
            CustomerServiceClient customerServiceClient) {
        this.supportTicketRepository = supportTicketRepository;
        this.incidentRepository = incidentRepository;
        this.messageRepository = messageRepository;
        this.customerServiceClient = customerServiceClient;
    }

    @Override
    public TicketClusterSweepSummary detectClusters() {
        OffsetDateTime now = OffsetDateTime.now();
        List<SupportTicket> candidates = supportTicketRepository
                .findByTicketStatusInAndRaisedAtAfter(LIVE_STATUSES, now.minusHours(WINDOW_HOURS));

        List<LocatedTicket> located = locate(candidates);
        List<DetectedCluster> clusters = TicketClusterAnalyzer.detectClusters(located);

        int opened = 0;
        int updated = 0;
        int bumped = 0;
        Set<UUID> stillActiveIncidentIds = new HashSet<>();

        for (DetectedCluster cluster : clusters) {
            Optional<TicketClusterIncident> existing = incidentRepository
                    .findByTicketCategoryAndTicketSubCategoryAndTerritoryKeyAndIncidentStatus(
                            cluster.key().ticketCategory(), cluster.key().ticketSubCategory(),
                            cluster.key().territoryKey(), STATUS_ACTIVE);

            TicketClusterIncident incident = existing.orElseGet(TicketClusterIncident::new);
            boolean isNew = existing.isEmpty();
            if (isNew) {
                incident.setTicketCategory(cluster.key().ticketCategory());
                incident.setTicketSubCategory(cluster.key().ticketSubCategory());
                incident.setTerritoryKey(cluster.key().territoryKey());
                incident.setCityId(cluster.cityId());
                incident.setZoneId(cluster.zoneId());
                incident.setDetectedAt(now);
                incident.setIncidentStatus(STATUS_ACTIVE);
            }
            incident.setTicketCount(cluster.tickets().size());
            incident.setDistinctRaiserCount(cluster.distinctRaisers());
            incident.setFirstSeenAt(cluster.firstSeenAt());
            incident.setLastSeenAt(cluster.lastSeenAt());
            incident.setLastEvaluatedAt(now);
            TicketClusterIncident savedIncident = incidentRepository.save(incident);
            stillActiveIncidentIds.add(savedIncident.getClusterIncidentId());
            if (isNew) {
                opened++;
            } else {
                updated++;
            }

            for (SupportTicket ticket : cluster.tickets()) {
                // A ticket is only ever acted on the first time it joins an incident. This is
                // what keeps a sweep running every 30 minutes from walking the same tickets up
                // to HIGH tier by tier: already-linked tickets are left exactly as they are.
                if (savedIncident.getClusterIncidentId().equals(ticket.getClusterIncidentId())) {
                    continue;
                }
                ticket.setClusterIncidentId(savedIncident.getClusterIncidentId());
                String nextTier = nextPriorityTier(ticket.getPriority());
                if (nextTier != null) {
                    ticket.setPriority(nextTier);
                    ticket.setDueBy(now.plusHours(slaThresholdHours(nextTier)));
                    bumped++;
                    leaveClusterNote(ticket, savedIncident, nextTier, now);
                }
                supportTicketRepository.save(ticket);
            }
        }

        int resolved = closeIncidentsNoLongerSeen(stillActiveIncidentIds, now);

        TicketClusterSweepSummary summary = new TicketClusterSweepSummary(
                candidates.size(), located.size(), clusters.size(), opened, updated, resolved, bumped);
        if (opened > 0 || bumped > 0 || resolved > 0) {
            log.info("Ticket cluster sweep: {} scanned, {} located, {} clusters, {} opened, {} updated, {} resolved, {} priority-bumped",
                    summary.ticketsScanned(), summary.ticketsWithResolvedTerritory(), summary.clustersDetected(),
                    summary.incidentsOpened(), summary.incidentsUpdated(), summary.incidentsResolved(),
                    summary.ticketsPriorityBumped());
        }
        return summary;
    }

    /**
     * Resolves a territory for each candidate ticket, dropping the ones that have none.
     *
     * <p>The only zone signal reachable from this service is the raising customer's default
     * delivery address (S3's internal customer service-area endpoint). A ticket raised by a
     * driver, retailer or fleet owner has no customerProfileId and therefore no territory, and
     * is excluded from clustering rather than being forced through a fragile lookup chain -
     * S4's internal order response carries no zone to resolve one from either. Lookups are
     * memoised per sweep so a zone with twenty complaining customers costs twenty calls at
     * most, not one per ticket.</p>
     */
    private List<LocatedTicket> locate(List<SupportTicket> candidates) {
        Map<UUID, CustomerServiceAreaResponse> serviceAreaCache = new HashMap<>();
        List<LocatedTicket> located = new ArrayList<>();
        for (SupportTicket ticket : candidates) {
            UUID customerProfileId = ticket.getCustomerProfileId();
            if (customerProfileId == null) continue;
            CustomerServiceAreaResponse area = serviceAreaCache.computeIfAbsent(customerProfileId, id -> {
                try {
                    return customerServiceClient.getCustomerServiceArea(id);
                } catch (Exception e) {
                    log.warn("Could not resolve service area for customer {}: {}", id, e.getMessage());
                    return null;
                }
            });
            if (area == null) continue;
            String territoryKey = TicketClusterAnalyzer.territoryKey(area.cityId(), area.zoneId());
            if (territoryKey == null) continue;
            located.add(new LocatedTicket(ticket, territoryKey, area.cityId(), area.zoneId()));
        }
        return located;
    }

    /**
     * Closes any incident that was ACTIVE but did not come back in this pass - either its
     * tickets were resolved or they aged out of the window, so the incident is over.
     */
    private int closeIncidentsNoLongerSeen(Set<UUID> stillActiveIncidentIds, OffsetDateTime now) {
        List<TicketClusterIncident> active = incidentRepository
                .findByIncidentStatusOrderByLastSeenAtDesc(STATUS_ACTIVE);
        List<TicketClusterIncident> toClose = new ArrayList<>();
        for (TicketClusterIncident incident : active) {
            if (stillActiveIncidentIds.contains(incident.getClusterIncidentId())) continue;
            incident.setIncidentStatus(STATUS_RESOLVED);
            incident.setResolvedAt(now);
            incident.setLastEvaluatedAt(now);
            toClose.add(incident);
        }
        incidentRepository.saveAll(toClose);
        return toClose.size();
    }

    /** Leaves a staff-only note so the priority change is explained on the ticket itself. */
    private void leaveClusterNote(SupportTicket ticket, TicketClusterIncident incident, String newTier,
            OffsetDateTime now) {
        SupportTicketMessage note = new SupportTicketMessage();
        note.setCustomerTicketId(ticket.getCustomerTicketId());
        note.setSenderAccountId(null);
        note.setSenderRole("SYSTEM");
        note.setMessage("Priority raised to " + newTier + ": this is one of " + incident.getTicketCount()
                + " tickets reporting " + incident.getTicketCategory() + "/" + incident.getTicketSubCategory()
                + " in " + incident.getTerritoryKey() + " within the last " + WINDOW_HOURS
                + "h (cluster incident " + incident.getClusterIncidentId() + ").");
        note.setInternalNote(true);
        note.setSentAt(now);
        messageRepository.save(note);
    }

    /** LOW -&gt; MEDIUM -&gt; HIGH; HIGH (or any unknown value) is already at the top. */
    private String nextPriorityTier(String priority) {
        if ("LOW".equals(priority)) return "MEDIUM";
        if ("MEDIUM".equals(priority)) return "HIGH";
        return null;
    }

    /** LOW -&gt; 72h, MEDIUM -&gt; 24h, HIGH -&gt; 4h; anything else defaults to MEDIUM's threshold. */
    private long slaThresholdHours(String priority) {
        if ("LOW".equals(priority)) return 72;
        if ("HIGH".equals(priority)) return 4;
        return 24;
    }

    @Override
    @Transactional(readOnly = true)
    public List<TicketClusterIncidentView> getActiveIncidents() {
        return incidentRepository.findByIncidentStatusOrderByLastSeenAtDesc(STATUS_ACTIVE)
                .stream().map(this::toView).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public TicketClusterIncidentView getIncident(UUID clusterIncidentId) {
        TicketClusterIncident incident = incidentRepository.findById(clusterIncidentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TicketClusterIncident not found: " + clusterIncidentId));
        return toView(incident);
    }

    private TicketClusterIncidentView toView(TicketClusterIncident incident) {
        List<SupportTicket> linked = supportTicketRepository
                .findByClusterIncidentId(incident.getClusterIncidentId());
        return new TicketClusterIncidentView(
                incident.getClusterIncidentId(), incident.getTicketCategory(),
                incident.getTicketSubCategory(), incident.getTerritoryKey(),
                incident.getCityId(), incident.getZoneId(), incident.getTicketCount(),
                incident.getDistinctRaiserCount(), incident.getFirstSeenAt(), incident.getLastSeenAt(),
                incident.getDetectedAt(), incident.getLastEvaluatedAt(), incident.getIncidentStatus(),
                linked.stream().map(SupportTicket::getCustomerTicketId).toList(),
                linked.stream().map(SupportTicket::getTicketNumber).toList());
    }
}
