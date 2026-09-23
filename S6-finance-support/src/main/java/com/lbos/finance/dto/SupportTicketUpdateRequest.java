package com.lbos.finance.dto;

/** Only descriptive fields are editable after a ticket is raised; status moves forward only
 *  through assign/resolve/close. */
public record SupportTicketUpdateRequest(String subject, String description, String priority) {
}
