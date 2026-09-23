package com.lbos.finance.dto;

/** Result of a single overdue-ticket escalation sweep. */
public record EscalationSummary(int ticketsScanned, int ticketsEscalated, int ticketsFlaggedAtMaxPriority) {
}
