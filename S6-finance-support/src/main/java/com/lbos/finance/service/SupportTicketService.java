package com.lbos.finance.service;
import java.util.List;
import java.util.UUID;
import com.lbos.finance.dto.DriverComplaintSummary;
import com.lbos.finance.dto.EscalationSummary;
import com.lbos.finance.dto.SupportTicketMessageRequest;
import com.lbos.finance.dto.SupportTicketRequest;
import com.lbos.finance.dto.SupportTicketUpdateRequest;
import com.lbos.finance.dto.TicketContext;
import com.lbos.finance.entity.SupportTicket;
import com.lbos.finance.entity.SupportTicketMessage;
public interface SupportTicketService {
    SupportTicket createSupportTicket(SupportTicketRequest request);
    List<SupportTicket> getAllSupportTickets();

    /** Only tickets raised by this account - backs GET /api/support-tickets/mine. */
    List<SupportTicket> getMyTickets(UUID raisedByAccountId);

    /** A staff role's escalation queue - tickets handed to that role for action. */
    List<SupportTicket> getTicketsEscalatedToRole(String role);

    /** A retailer's or fleet owner's own "escalated to me" queue. entityType is "RETAILER" or "FLEET_OWNER". */
    List<SupportTicket> getTicketsEscalatedToEntity(String entityType, UUID entityId);
    SupportTicket getSupportTicketById(UUID id);

    /** Consolidated order/items/trip/customer context for a ticket's linked order, if any. */
    TicketContext getTicketContext(UUID id);
    SupportTicket updateSupportTicket(UUID id, SupportTicketUpdateRequest request);

    /** OPEN -> IN_PROGRESS. */
    SupportTicket assignTicket(UUID id, UUID supportAccountId);
    /** IN_PROGRESS -> RESOLVED. */
    SupportTicket resolveTicket(UUID id);
    /** RESOLVED -> CLOSED. */
    SupportTicket closeTicket(UUID id);

    /**
     * Hands an IN_PROGRESS ticket the current handler can't resolve either to a specific
     * responsible role (SUPER_ADMIN / OPERATIONS_MANAGER / LOCATION_MANAGER) or directly to the
     * specific business it's about (RETAILER / FLEET_OWNER) - status stays IN_PROGRESS, only the
     * escalation metadata changes. Exactly one of toRole or (toEntityType + toEntityId) must be
     * non-null; the other pair is left null on the saved ticket.
     */
    SupportTicket escalateTicket(UUID id, String toRole, String toEntityType, UUID toEntityId, String reason, UUID escalatedByAccountId);

    /** Only an unassigned, still-OPEN ticket may be deleted. */
    void deleteSupportTicket(UUID id);

    /** Bumps priority on OPEN tickets that have breached their priority's SLA threshold. */
    EscalationSummary escalateOverdueTickets();

    /**
     * Posts a message to a ticket's conversation thread. internalNote is forced to false unless
     * the sender is staff (SUPER_ADMIN/OPERATIONS_MANAGER/SUPPORT_STAFF/LOCATION_MANAGER).
     */
    SupportTicketMessage addMessage(UUID ticketId, UUID senderAccountId, String senderRole, SupportTicketMessageRequest request);

    /**
     * The visible thread for a given viewer: staff see every message (including internal
     * notes); the ticket's raiser sees only non-internal messages.
     */
    List<SupportTicketMessage> getMessages(UUID ticketId, boolean includeInternalNotes);

    /** Privacy-safe "complaints on my trips" view for a driver, resolved from their own
     *  userAccountId (the JWT subject) - never exposes the raising customer's contact info. */
    List<DriverComplaintSummary> getComplaintsForDriverUserAccount(UUID userAccountId);
}
