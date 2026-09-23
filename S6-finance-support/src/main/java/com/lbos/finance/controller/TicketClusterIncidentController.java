package com.lbos.finance.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.*;

import com.lbos.finance.dto.TicketClusterIncidentView;
import com.lbos.finance.dto.TicketClusterSweepSummary;
import com.lbos.finance.service.TicketClusterService;

/**
 * Staff-facing insight surface for zone-level support-ticket clusters: the "several people are
 * reporting the same thing in the same place" view that no individual ticket can show.
 *
 * <p>Deliberately mounted under its own /api/support-insights path rather than nested under
 * /api/support-tickets - the latter's security matchers include a broad
 * {@code GET /api/support-tickets/*} that any authenticated user may hit (their own ticket),
 * and a nested path would silently inherit it. Role gating lives in SecurityConfig.</p>
 */
@RestController
@RequestMapping("/api/support-insights")
public class TicketClusterIncidentController {

    private final TicketClusterService ticketClusterService;

    /**
     * Creates the controller with the clustering service backing it.
     *
     * @param ticketClusterService the service providing cluster incidents
     */
    public TicketClusterIncidentController(TicketClusterService ticketClusterService) {
        this.ticketClusterService = ticketClusterService;
    }

    /**
     * Lists the currently active cluster incidents, most recently seen first.
     *
     * @return the active cluster incidents
     */
    @GetMapping("/cluster-incidents")
    public List<TicketClusterIncidentView> getActiveClusterIncidents() {
        return ticketClusterService.getActiveIncidents();
    }

    /**
     * Fetches one cluster incident (active or already auto-resolved) with its linked tickets.
     *
     * @param clusterIncidentId the incident id
     * @return the incident
     */
    @GetMapping("/cluster-incidents/{clusterIncidentId}")
    public TicketClusterIncidentView getClusterIncident(@PathVariable UUID clusterIncidentId) {
        return ticketClusterService.getIncident(clusterIncidentId);
    }

    /**
     * Runs the clustering detection pass immediately instead of waiting for the scheduler -
     * the same manual-trigger affordance the SLA sweep has, useful for demos and for a manager
     * who has just fixed something and wants the board refreshed.
     *
     * @return a summary of what the pass did
     */
    @PostMapping("/cluster-incidents/detect")
    public TicketClusterSweepSummary detectNow() {
        return ticketClusterService.detectClusters();
    }
}
