package com.lbos.finance.dto;

import java.time.OffsetDateTime;

/**
 * Privacy-safe subset of SupportTicket for the driver "my complaints" view - deliberately
 * excludes the raising customer's contact info, internal notes, and assignment details, since
 * a driver should see that a complaint exists and its status, not the customer's private data.
 */
public record DriverComplaintSummary(
        String ticketNumber,
        String subject,
        String ticketCategory,
        String ticketStatus,
        OffsetDateTime escalatedAt,
        OffsetDateTime resolvedAt,
        OffsetDateTime dueBy) {
}
