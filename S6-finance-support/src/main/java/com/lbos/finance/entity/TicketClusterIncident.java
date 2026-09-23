package com.lbos.finance.entity;

import java.time.OffsetDateTime;
import java.util.UUID;

import jakarta.persistence.*;

/**
 * A detected "many people, same problem, same place" incident: several still-open support
 * tickets sharing a category/sub-category and a territory inside a rolling time window.
 *
 * <p>Persisted (rather than recomputed on every read) for three reasons: the sweep needs a
 * memory of what it has already acted on so it does not bump the same tickets' priority twice,
 * tickets link back to it via {@link SupportTicket#getClusterIncidentId()}, and the
 * staff-facing insight endpoint can serve it without re-running Feign zone lookups per
 * request.</p>
 */
@Entity
@Table(name = "ticket_cluster_incident")
public class TicketClusterIncident {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID clusterIncidentId;

    /** The shared ticket category (e.g. "DELIVERY") every ticket in this cluster reported. */
    private String ticketCategory;

    /** The shared ticket sub-category (e.g. "LATE_DELIVERY"); may be null if tickets carry none. */
    private String ticketSubCategory;

    /**
     * The grouping territory key, in the form "ZONE:&lt;uuid&gt;" or - when a ticket's address
     * has a city but no assigned zone - "CITY:&lt;uuid&gt;". Kept as a single string so the
     * cluster key is one comparable value, with the parsed ids stored alongside for callers.
     */
    private String territoryKey;

    private UUID cityId;

    private UUID zoneId;

    /** How many tickets were in this cluster when it was last observed. */
    private int ticketCount;

    /** How many DISTINCT accounts raised those tickets - the number the threshold is applied to. */
    private int distinctRaiserCount;

    /** The earliest raisedAt among the clustered tickets - when the underlying problem started. */
    private OffsetDateTime firstSeenAt;

    /** The latest raisedAt among the clustered tickets - how fresh the problem still is. */
    private OffsetDateTime lastSeenAt;

    /** When the sweep first created this incident record. */
    private OffsetDateTime detectedAt;

    /** When the sweep last re-observed this incident as still active. */
    private OffsetDateTime lastEvaluatedAt;

    /** "ACTIVE" while the cluster still meets the threshold, "RESOLVED" once it no longer does. */
    private String incidentStatus;

    /** When the incident stopped meeting the threshold and was auto-closed. */
    private OffsetDateTime resolvedAt;

    /**
     * Returns the incident id.
     *
     * @return the incident id
     */
    public UUID getClusterIncidentId() { return clusterIncidentId; }

    /**
     * Sets the incident id.
     *
     * @param clusterIncidentId the incident id
     */
    public void setClusterIncidentId(UUID clusterIncidentId) { this.clusterIncidentId = clusterIncidentId; }

    /**
     * Returns the shared ticket category.
     *
     * @return the ticket category
     */
    public String getTicketCategory() { return ticketCategory; }

    /**
     * Sets the shared ticket category.
     *
     * @param ticketCategory the ticket category
     */
    public void setTicketCategory(String ticketCategory) { this.ticketCategory = ticketCategory; }

    /**
     * Returns the shared ticket sub-category.
     *
     * @return the ticket sub-category
     */
    public String getTicketSubCategory() { return ticketSubCategory; }

    /**
     * Sets the shared ticket sub-category.
     *
     * @param ticketSubCategory the ticket sub-category
     */
    public void setTicketSubCategory(String ticketSubCategory) { this.ticketSubCategory = ticketSubCategory; }

    /**
     * Returns the territory key this cluster was grouped on.
     *
     * @return the territory key
     */
    public String getTerritoryKey() { return territoryKey; }

    /**
     * Sets the territory key this cluster was grouped on.
     *
     * @param territoryKey the territory key
     */
    public void setTerritoryKey(String territoryKey) { this.territoryKey = territoryKey; }

    /**
     * Returns the city this cluster sits in.
     *
     * @return the city id, or {@code null} if unknown
     */
    public UUID getCityId() { return cityId; }

    /**
     * Sets the city this cluster sits in.
     *
     * @param cityId the city id
     */
    public void setCityId(UUID cityId) { this.cityId = cityId; }

    /**
     * Returns the zone this cluster sits in.
     *
     * @return the zone id, or {@code null} if the cluster is only city-level
     */
    public UUID getZoneId() { return zoneId; }

    /**
     * Sets the zone this cluster sits in.
     *
     * @param zoneId the zone id
     */
    public void setZoneId(UUID zoneId) { this.zoneId = zoneId; }

    /**
     * Returns the ticket count last observed for this cluster.
     *
     * @return the ticket count
     */
    public int getTicketCount() { return ticketCount; }

    /**
     * Sets the ticket count last observed for this cluster.
     *
     * @param ticketCount the ticket count
     */
    public void setTicketCount(int ticketCount) { this.ticketCount = ticketCount; }

    /**
     * Returns how many distinct accounts raised the clustered tickets.
     *
     * @return the distinct raiser count
     */
    public int getDistinctRaiserCount() { return distinctRaiserCount; }

    /**
     * Sets how many distinct accounts raised the clustered tickets.
     *
     * @param distinctRaiserCount the distinct raiser count
     */
    public void setDistinctRaiserCount(int distinctRaiserCount) { this.distinctRaiserCount = distinctRaiserCount; }

    /**
     * Returns when the earliest clustered ticket was raised.
     *
     * @return the first-seen timestamp
     */
    public OffsetDateTime getFirstSeenAt() { return firstSeenAt; }

    /**
     * Sets when the earliest clustered ticket was raised.
     *
     * @param firstSeenAt the first-seen timestamp
     */
    public void setFirstSeenAt(OffsetDateTime firstSeenAt) { this.firstSeenAt = firstSeenAt; }

    /**
     * Returns when the latest clustered ticket was raised.
     *
     * @return the last-seen timestamp
     */
    public OffsetDateTime getLastSeenAt() { return lastSeenAt; }

    /**
     * Sets when the latest clustered ticket was raised.
     *
     * @param lastSeenAt the last-seen timestamp
     */
    public void setLastSeenAt(OffsetDateTime lastSeenAt) { this.lastSeenAt = lastSeenAt; }

    /**
     * Returns when this incident was first detected.
     *
     * @return the detected-at timestamp
     */
    public OffsetDateTime getDetectedAt() { return detectedAt; }

    /**
     * Sets when this incident was first detected.
     *
     * @param detectedAt the detected-at timestamp
     */
    public void setDetectedAt(OffsetDateTime detectedAt) { this.detectedAt = detectedAt; }

    /**
     * Returns when the sweep last re-observed this incident.
     *
     * @return the last-evaluated timestamp
     */
    public OffsetDateTime getLastEvaluatedAt() { return lastEvaluatedAt; }

    /**
     * Sets when the sweep last re-observed this incident.
     *
     * @param lastEvaluatedAt the last-evaluated timestamp
     */
    public void setLastEvaluatedAt(OffsetDateTime lastEvaluatedAt) { this.lastEvaluatedAt = lastEvaluatedAt; }

    /**
     * Returns the incident's status ("ACTIVE" or "RESOLVED").
     *
     * @return the incident status
     */
    public String getIncidentStatus() { return incidentStatus; }

    /**
     * Sets the incident's status.
     *
     * @param incidentStatus the incident status
     */
    public void setIncidentStatus(String incidentStatus) { this.incidentStatus = incidentStatus; }

    /**
     * Returns when the incident was auto-closed.
     *
     * @return the resolved-at timestamp, or {@code null} while still active
     */
    public OffsetDateTime getResolvedAt() { return resolvedAt; }

    /**
     * Sets when the incident was auto-closed.
     *
     * @param resolvedAt the resolved-at timestamp
     */
    public void setResolvedAt(OffsetDateTime resolvedAt) { this.resolvedAt = resolvedAt; }
}
