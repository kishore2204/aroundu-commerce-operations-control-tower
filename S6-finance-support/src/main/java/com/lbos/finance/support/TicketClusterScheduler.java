package com.lbos.finance.support;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.lbos.finance.dto.TicketClusterSweepSummary;
import com.lbos.finance.service.TicketClusterService;

/**
 * Runs the zone-level ticket-clustering detection pass
 * ({@link TicketClusterService#detectClusters()}) on a timer, the same posture as
 * {@link SupportTicketSlaScheduler}.
 *
 * <p>Every 30 minutes rather than the SLA sweep's 15: a cluster is a property of a 48-hour
 * window, so half-hourly is plenty to catch one while it is still worth acting on, and each
 * pass costs one Feign service-area lookup per distinct complaining customer - a cost worth
 * halving.</p>
 */
@Component
public class TicketClusterScheduler {

    private static final Logger log = LoggerFactory.getLogger(TicketClusterScheduler.class);

    private final TicketClusterService ticketClusterService;

    /**
     * Creates the scheduler with the clustering service it drives.
     *
     * @param ticketClusterService the service performing the detection pass
     */
    public TicketClusterScheduler(TicketClusterService ticketClusterService) {
        this.ticketClusterService = ticketClusterService;
    }

    /** Runs one detection pass; a failure is logged and never propagated into the scheduler. */
    @Scheduled(fixedRate = 1800000)
    public void sweep() {
        try {
            TicketClusterSweepSummary summary = ticketClusterService.detectClusters();
            if (summary.incidentsOpened() > 0 || summary.ticketsPriorityBumped() > 0) {
                log.info("Ticket cluster sweep opened {} incident(s) and bumped {} ticket(s)",
                        summary.incidentsOpened(), summary.ticketsPriorityBumped());
            }
        } catch (Exception e) {
            log.warn("Ticket cluster sweep failed: {}", e.getMessage(), e);
        }
    }
}
