package com.lbos.finance.dto;

/** internalNote is only honored when the sender is staff - the service silently forces it to
 *  false for a ticket-raiser's own message (they can never post a "staff-only" note). */
public record SupportTicketMessageRequest(String message, boolean internalNote) { }
