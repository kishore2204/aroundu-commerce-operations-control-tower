package com.lbos.finance.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * A cluster incident as shown to Support Staff, Operations Managers and Super Admins: the
 * shared complaint, where it is happening, how big and how fresh it is, and which tickets make
 * it up so a handler can jump straight into them.
 *
 * @param clusterIncidentId the incident id
 * @param ticketCategory the shared ticket category
 * @param ticketSubCategory the shared ticket sub-category ("-" when the tickets carry none)
 * @param territoryKey the territory key ("ZONE:&lt;uuid&gt;" or "CITY:&lt;uuid&gt;")
 * @param cityId the city the incident sits in, if known
 * @param zoneId the zone the incident sits in, if known
 * @param ticketCount how many tickets are in the cluster
 * @param distinctRaiserCount how many distinct accounts raised them
 * @param firstSeenAt when the earliest clustered ticket was raised
 * @param lastSeenAt when the latest clustered ticket was raised
 * @param detectedAt when the sweep first opened this incident
 * @param lastEvaluatedAt when the sweep last re-confirmed it
 * @param incidentStatus "ACTIVE" or "RESOLVED"
 * @param ticketIds the ids of the linked tickets
 * @param ticketNumbers the human-readable numbers of the linked tickets
 */
public record TicketClusterIncidentView(UUID clusterIncidentId, String ticketCategory,
        String ticketSubCategory, String territoryKey, UUID cityId, UUID zoneId,
        int ticketCount, int distinctRaiserCount, OffsetDateTime firstSeenAt,
        OffsetDateTime lastSeenAt, OffsetDateTime detectedAt, OffsetDateTime lastEvaluatedAt,
        String incidentStatus, List<UUID> ticketIds, List<String> ticketNumbers) { }
