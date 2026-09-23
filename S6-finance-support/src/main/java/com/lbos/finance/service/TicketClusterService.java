package com.lbos.finance.service;

import java.util.List;
import java.util.UUID;

import com.lbos.finance.dto.TicketClusterIncidentView;
import com.lbos.finance.dto.TicketClusterSweepSummary;

/**
 * Detects and exposes "many people, same problem, same place" support-ticket incidents.
 *
 * <p>A single LOW-priority ticket looks harmless on its own; several of them reporting the same
 * category in the same zone inside a couple of days is an operational incident that no per-
 * ticket rule can see. This service is what notices that, raises the affected tickets'
 * priority, and keeps a queryable record for staff.</p>
 */
public interface TicketClusterService {

    /**
     * Runs one detection pass over the still-live tickets in the rolling window: groups them,
     * opens/refreshes incidents for groups over the threshold, links their tickets, bumps
     * newly-clustered LOW/MEDIUM tickets, and auto-resolves incidents that have gone quiet.
     *
     * @return a summary of what this pass did
     */
    TicketClusterSweepSummary detectClusters();

    /**
     * Lists the currently active cluster incidents for the staff insight views.
     *
     * @return the active incidents, most recently seen first
     */
    List<TicketClusterIncidentView> getActiveIncidents();

    /**
     * Fetches one cluster incident, active or resolved.
     *
     * @param clusterIncidentId the incident id
     * @return the incident
     */
    TicketClusterIncidentView getIncident(UUID clusterIncidentId);
}
