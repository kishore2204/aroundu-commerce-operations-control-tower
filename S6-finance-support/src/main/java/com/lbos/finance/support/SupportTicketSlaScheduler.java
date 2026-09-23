package com.lbos.finance.support;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.lbos.finance.dto.EscalationSummary;
import com.lbos.finance.service.SupportTicketService;

/**
 * Runs the SLA-breach sweep automatically (SupportTicketServiceImpl.escalateOverdueTickets) -
 * previously this only ever ran if something called POST /api/support-tickets/escalate-overdue,
 * which nothing in this codebase ever did, so no ticket's priority/escalation state moved on its
 * own no matter how long it sat OPEN. Every 15 minutes is frequent enough for the shortest SLA
 * tier (HIGH, 4h) to still get caught reasonably close to its actual breach time.
 */
@Component
public class SupportTicketSlaScheduler {

    private static final Logger log = LoggerFactory.getLogger(SupportTicketSlaScheduler.class);

    private final SupportTicketService supportTicketService;

    public SupportTicketSlaScheduler(SupportTicketService supportTicketService) {
        this.supportTicketService = supportTicketService;
    }

    @Scheduled(fixedRate = 900000)
    public void sweep() {
        try {
            EscalationSummary summary = supportTicketService.escalateOverdueTickets();
            if (summary.ticketsEscalated() > 0 || summary.ticketsFlaggedAtMaxPriority() > 0) {
                log.info("Support ticket SLA sweep: {} scanned, {} priority-bumped, {} flagged/auto-escalated",
                        summary.ticketsScanned(), summary.ticketsEscalated(), summary.ticketsFlaggedAtMaxPriority());
            }
        } catch (Exception e) {
            log.warn("Support ticket SLA sweep failed: {}", e.getMessage(), e);
        }
    }
}
