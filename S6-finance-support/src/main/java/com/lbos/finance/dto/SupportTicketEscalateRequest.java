package com.lbos.finance.dto;

import java.util.UUID;

/**
 * Exactly one of two escalation modes must be supplied:
 *  - toRole: one of SUPER_ADMIN, OPERATIONS_MANAGER, LOCATION_MANAGER - an internal staff
 *    handler who couldn't resolve the ticket hands it to a broader internal role.
 *  - toEntityType ("RETAILER" or "FLEET_OWNER") + toEntityId: the ticket is instead handed
 *    directly to the specific business it's actually about (e.g. a wrong-item complaint goes
 *    to that retailer, a driver-conduct complaint goes to that fleet owner), so their own
 *    portal queue (GET /api/support-tickets/escalated-to-entity) can see and respond to it.
 */
public record SupportTicketEscalateRequest(String toRole, String toEntityType, UUID toEntityId, String reason) { }
