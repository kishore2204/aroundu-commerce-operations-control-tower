package com.lbos.finance.dto;
import java.util.UUID;

/**
 * customerProfileId is only required when raisedByRole is "CUSTOMER" - every other role has no
 * customer_profile row to reference (see database.sql's support_ticket.customer_profile_id,
 * now nullable). ticketCategory/ticketSubCategory are validated against
 * SupportTicketCategories for the given raisedByRole - an invalid combination is rejected.
 */
public record SupportTicketRequest(UUID customerProfileId, Long orderId, UUID raisedByAccountId, String raisedByRole, String ticketCategory, String ticketSubCategory, String ticketNumber, String subject, String description, String priority) { }
