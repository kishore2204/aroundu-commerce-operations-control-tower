package com.lbos.finance.service;
import java.time.*; import java.util.*;
import org.slf4j.Logger; import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service; import org.springframework.transaction.annotation.Transactional;
import com.lbos.finance.dto.*; import com.lbos.finance.entity.*; import com.lbos.finance.exception.*; import com.lbos.finance.integration.client.*; import com.lbos.finance.integration.dto.*; import com.lbos.finance.repository.*;
import com.lbos.finance.support.SupportTicketCategories;

/**
 * Status now only advances via assign/resolve/close - previously a generic PUT reset an
 * already-RESOLVED ticket straight back to OPEN and wiped its assignment/resolvedAt, so no
 * ticket could ever stay resolved through an unrelated edit.
 */
@Service @Transactional
public class SupportTicketServiceImpl implements SupportTicketService {
    private static final Logger log = LoggerFactory.getLogger(SupportTicketServiceImpl.class);
    private static final Set<String> ESCALATION_TARGET_ROLES = Set.of("SUPER_ADMIN", "OPERATIONS_MANAGER", "LOCATION_MANAGER");
    private static final Set<String> ESCALATION_TARGET_ENTITY_TYPES = Set.of("RETAILER", "FLEET_OWNER");
    private static final Set<String> STAFF_ROLES = Set.of("SUPER_ADMIN", "OPERATIONS_MANAGER", "SUPPORT_STAFF", "LOCATION_MANAGER");

    private final SupportTicketRepository supportTicketRepository;
    private final SupportTicketMessageRepository messageRepository;
    private final IdentityServiceClient identityServiceClient; private final CustomerServiceClient customerServiceClient; private final OrderServiceClient orderServiceClient; private final LogisticsServiceClient logisticsServiceClient; private final NotificationService notificationService; private final FleetServiceClient fleetServiceClient; private final PartnerServiceClient partnerServiceClient;
    public SupportTicketServiceImpl(SupportTicketRepository supportTicketRepository, SupportTicketMessageRepository messageRepository, IdentityServiceClient identityServiceClient, CustomerServiceClient customerServiceClient, OrderServiceClient orderServiceClient, LogisticsServiceClient logisticsServiceClient, NotificationService notificationService, FleetServiceClient fleetServiceClient, PartnerServiceClient partnerServiceClient) {
        this.supportTicketRepository=supportTicketRepository; this.messageRepository=messageRepository; this.identityServiceClient=identityServiceClient; this.customerServiceClient=customerServiceClient; this.orderServiceClient=orderServiceClient; this.logisticsServiceClient=logisticsServiceClient; this.notificationService=notificationService; this.fleetServiceClient=fleetServiceClient; this.partnerServiceClient=partnerServiceClient;
    }

    @Override
    @Transactional(readOnly = true)
    public List<DriverComplaintSummary> getComplaintsForDriverUserAccount(UUID userAccountId) {
        try {
            var driver = fleetServiceClient.getDriverByUserAccountId(userAccountId);
            if (driver == null || driver.driverId() == null) return List.of();
            List<Long> orderIds = logisticsServiceClient.getOrderIdsForDriver(driver.driverId());
            if (orderIds.isEmpty()) return List.of();
            return supportTicketRepository.findByOrderIdIn(orderIds).stream()
                    .map(t -> new DriverComplaintSummary(t.getTicketNumber(), t.getSubject(), t.getTicketCategory(),
                            t.getTicketStatus(), t.getEscalatedAt(), t.getResolvedAt(), t.getDueBy()))
                    .toList();
        } catch (Exception e) {
            log.warn("Could not resolve complaints for driver user account {}: {}", userAccountId, e.getMessage());
            return List.of();
        }
    }

    @Override public SupportTicket createSupportTicket(SupportTicketRequest request) {
        if (!SupportTicketCategories.isKnownRole(request.raisedByRole())) {
            throw new BusinessRuleException("Unknown raisedByRole: " + request.raisedByRole());
        }
        if (!SupportTicketCategories.isValid(request.raisedByRole(), request.ticketCategory(), request.ticketSubCategory())) {
            throw new BusinessRuleException("Invalid category/subCategory '" + request.ticketCategory() + "/" + request.ticketSubCategory() + "' for role " + request.raisedByRole());
        }
        UserAccountResponse raisedByAccount = identityServiceClient.getUserAccount(request.raisedByAccountId());
        if (!"ACTIVE".equals(raisedByAccount.accountStatus())) throw new BusinessRuleException("Raising account is inactive");

        SupportTicket entity = new SupportTicket();
        boolean isCustomer = "CUSTOMER".equals(request.raisedByRole());
        if (isCustomer) {
            if (request.customerProfileId() == null) throw new BusinessRuleException("customerProfileId is required for a CUSTOMER-raised ticket");
            CustomerProfileResponse customerProfileResponse = customerServiceClient.getCustomerProfile(request.customerProfileId());
            if (request.orderId() != null) {
                OrderResponse orderResponse = orderServiceClient.getOrderById(request.orderId());
                if (!orderResponse.customerProfileId().equals(customerProfileResponse.customerProfileId())) throw new BusinessRuleException("Order does not belong to customer");
            }
            entity.setCustomerProfileId(request.customerProfileId());
        } else {
            // Non-customer roles have no customer_profile row; orderId (if given) is stored as
            // context but not ownership-validated here - that would need a Feign round-trip per
            // role (order_item.retailerId / trip.fleetOwnerId) that isn't built yet.
            entity.setCustomerProfileId(null);
        }
        entity.setOrderId(request.orderId());
        entity.setRaisedByAccountId(request.raisedByAccountId());
        entity.setRaisedByRole(request.raisedByRole());
        entity.setTicketCategory(request.ticketCategory());
        entity.setTicketSubCategory(request.ticketSubCategory());
        entity.setTicketNumber(request.ticketNumber());
        entity.setSubject(request.subject());
        entity.setDescription(request.description());
        entity.setPriority(request.priority());
        entity.setTicketStatus("OPEN");
        entity.setRaisedAt(OffsetDateTime.now());
        entity.setDueBy(computeDueBy(entity.getPriority(), entity.getRaisedAt()));
        return supportTicketRepository.save(entity);
    }

    @Override public List<SupportTicket> getAllSupportTickets() { return supportTicketRepository.findAll(); }
    @Override public List<SupportTicket> getMyTickets(UUID raisedByAccountId) { return supportTicketRepository.findByRaisedByAccountId(raisedByAccountId); }
    @Override public List<SupportTicket> getTicketsEscalatedToRole(String role) { return supportTicketRepository.findByEscalatedToRole(role); }
    @Override public List<SupportTicket> getTicketsEscalatedToEntity(String entityType, UUID entityId) { return supportTicketRepository.findByEscalatedToEntityTypeAndEscalatedToEntityId(entityType, entityId); }
    @Override public SupportTicket getSupportTicketById(UUID id) { return supportTicketRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("SupportTicket not found: " + id)); }

    @Override public TicketContext getTicketContext(UUID id) {
        SupportTicket ticket = getSupportTicketById(id);
        OrderResponse order = null; List<OrderItemResponse> items = List.of(); TripResponse trip = null; CustomerProfileResponse customer = null;
        if (ticket.getOrderId() != null) {
            try { order = orderServiceClient.getOrderById(ticket.getOrderId()); } catch (Exception e) { log.warn("Could not load order {} for ticket {} context: {}", ticket.getOrderId(), id, e.getMessage()); }
            try { items = orderServiceClient.getOrderItems(ticket.getOrderId()); } catch (Exception e) { log.warn("Could not load order items for ticket {} context: {}", id, e.getMessage()); }
            try { trip = logisticsServiceClient.getTripByOrderId(ticket.getOrderId()); } catch (Exception e) { log.warn("Could not load trip for ticket {} context: {}", id, e.getMessage()); }
        }
        if (ticket.getCustomerProfileId() != null) {
            try { customer = customerServiceClient.getCustomerProfile(ticket.getCustomerProfileId()); } catch (Exception e) { log.warn("Could not load customer profile for ticket {} context: {}", id, e.getMessage()); }
        }
        String retailerBusinessName = null;
        UUID retailerId = items.stream().map(OrderItemResponse::retailerId).filter(Objects::nonNull).findFirst().orElse(null);
        if (retailerId != null) {
            try { retailerBusinessName = partnerServiceClient.getRetailer(retailerId).businessName(); }
            catch (Exception e) { log.warn("Could not load retailer {} name for ticket {}: {}", retailerId, id, e.getMessage()); }
        }
        String fleetOwnerBusinessName = null;
        if (trip != null && trip.fleetOwnerId() != null) {
            try { fleetOwnerBusinessName = partnerServiceClient.getFleetOwner(trip.fleetOwnerId()).businessName(); }
            catch (Exception e) { log.warn("Could not load fleet owner {} name for ticket {}: {}", trip.fleetOwnerId(), id, e.getMessage()); }
        }
        return new TicketContext(order, items, trip, customer, retailerBusinessName, fleetOwnerBusinessName);
    }

    @Override public SupportTicket updateSupportTicket(UUID id, SupportTicketUpdateRequest request) {
        SupportTicket existing = getSupportTicketById(id);
        if ("CLOSED".equals(existing.getTicketStatus())) {
            throw new BusinessRuleException("Ticket " + id + " is CLOSED and can no longer be edited");
        }
        if (request.subject() != null) existing.setSubject(request.subject());
        if (request.description() != null) existing.setDescription(request.description());
        if (request.priority() != null && !request.priority().equals(existing.getPriority())) {
            existing.setPriority(request.priority());
            existing.setDueBy(computeDueBy(existing.getPriority(), OffsetDateTime.now()));
        }
        return supportTicketRepository.save(existing);
    }

    @Override public SupportTicket assignTicket(UUID id, UUID supportAccountId) {
        SupportTicket existing = requireStatus(id, "OPEN", "assigned");
        existing.setAssignedSupportAccountId(supportAccountId);
        existing.setTicketStatus("IN_PROGRESS");
        SupportTicket saved = supportTicketRepository.save(existing);
        notify(supportAccountId, "SUPPORT_TICKET_ASSIGNED", "Ticket assigned to you",
                "Ticket " + saved.getTicketNumber() + " (" + saved.getSubject() + ") has been assigned to you.", saved.getCustomerTicketId());
        return saved;
    }

    @Override public SupportTicket resolveTicket(UUID id) {
        SupportTicket existing = requireStatus(id, "IN_PROGRESS", "resolved");
        existing.setTicketStatus("RESOLVED");
        existing.setResolvedAt(OffsetDateTime.now());
        SupportTicket saved = supportTicketRepository.save(existing);
        notify(saved.getRaisedByAccountId(), "SUPPORT_TICKET_RESOLVED", "Your ticket has been resolved",
                "Ticket " + saved.getTicketNumber() + " (" + saved.getSubject() + ") has been resolved.", saved.getCustomerTicketId());
        return saved;
    }

    @Override public SupportTicket closeTicket(UUID id) {
        SupportTicket existing = requireStatus(id, "RESOLVED", "closed");
        existing.setTicketStatus("CLOSED");
        SupportTicket saved = supportTicketRepository.save(existing);
        notify(saved.getRaisedByAccountId(), "SUPPORT_TICKET_CLOSED", "Your ticket has been closed",
                "Ticket " + saved.getTicketNumber() + " (" + saved.getSubject() + ") has been closed.", saved.getCustomerTicketId());
        return saved;
    }

    @Override public SupportTicket escalateTicket(UUID id, String toRole, String toEntityType, UUID toEntityId, String reason, UUID escalatedByAccountId) {
        boolean roleMode = toRole != null;
        boolean entityMode = toEntityType != null || toEntityId != null;
        if (roleMode == entityMode) {
            throw new BusinessRuleException("Escalate exactly one of toRole or (toEntityType + toEntityId), not both/neither");
        }
        if (roleMode && !ESCALATION_TARGET_ROLES.contains(toRole)) {
            throw new BusinessRuleException("toRole must be one of " + ESCALATION_TARGET_ROLES + ", was: " + toRole);
        }
        if (entityMode && (!ESCALATION_TARGET_ENTITY_TYPES.contains(toEntityType) || toEntityId == null)) {
            throw new BusinessRuleException("toEntityType must be one of " + ESCALATION_TARGET_ENTITY_TYPES + " with a non-null toEntityId");
        }
        if (reason == null || reason.isBlank()) {
            throw new BusinessRuleException("An escalation reason is required");
        }
        SupportTicket existing = requireStatus(id, "IN_PROGRESS", "escalated");
        existing.setEscalatedToRole(roleMode ? toRole : null);
        existing.setEscalatedToEntityType(entityMode ? toEntityType : null);
        existing.setEscalatedToEntityId(entityMode ? toEntityId : null);
        existing.setEscalatedByAccountId(escalatedByAccountId);
        existing.setEscalationReason(reason);
        existing.setEscalatedAt(OffsetDateTime.now());
        SupportTicket saved = supportTicketRepository.save(existing);

        String target = roleMode ? toRole : ("the " + (toEntityType.equals("RETAILER") ? "retailer" : "fleet owner") + " for this order");
        SupportTicketMessage note = new SupportTicketMessage();
        note.setCustomerTicketId(id);
        note.setSenderAccountId(escalatedByAccountId);
        note.setSenderRole("SYSTEM");
        note.setMessage("Ticket escalated to " + target + ": " + reason);
        note.setInternalNote(true);
        note.setSentAt(OffsetDateTime.now());
        messageRepository.save(note);

        notify(saved.getRaisedByAccountId(), "SUPPORT_TICKET_ESCALATED", "Your ticket has been escalated",
                "Ticket " + saved.getTicketNumber() + " (" + saved.getSubject() + ") has been escalated to " + target + " for further review.",
                saved.getCustomerTicketId());

        return saved;
    }

    /** Best-effort - a notification failure (e.g. recipient account inactive) must never block
     *  the ticket action that triggered it, same posture as every other cross-cutting side
     *  effect in this codebase (dispatch-to-location-manager, S4->S6 payment confirmation, etc). */
    private void notify(UUID recipientAccountId, String notificationType, String title, String message, UUID ticketId) {
        if (recipientAccountId == null) return;
        try {
            notificationService.createNotification(new NotificationRequest(recipientAccountId, null, notificationType, "SUPPORT_TICKET", ticketId.toString(), title, message));
        } catch (Exception e) {
            log.warn("Failed to send {} notification for ticket {}: {}", notificationType, ticketId, e.getMessage());
        }
    }

    private SupportTicket requireStatus(UUID id, String requiredStatus, String action) {
        SupportTicket existing = getSupportTicketById(id);
        if (!requiredStatus.equals(existing.getTicketStatus())) {
            throw new BusinessRuleException("Ticket " + id + " must be " + requiredStatus + " before it can be " + action + " (currently " + existing.getTicketStatus() + ")");
        }
        return existing;
    }

    @Override public void deleteSupportTicket(UUID id) {
        SupportTicket existing = getSupportTicketById(id);
        if (!"OPEN".equals(existing.getTicketStatus())) {
            throw new BusinessRuleException("Only an OPEN ticket may be deleted; " + id + " is already " + existing.getTicketStatus());
        }
        supportTicketRepository.delete(existing);
    }

    /**
     * Sweeps all OPEN tickets and bumps priority on any that have breached their priority's SLA
     * threshold. Idempotent-safe: since this always compares the ticket's CURRENT priority
     * against elapsed time from raisedAt (no escalation history is tracked), re-running it
     * immediately after an escalation won't double-bump a ticket that's still within its new
     * tier's threshold.
     */
    /**
     * A HIGH-priority ticket that breaches again (nowhere further to bump) gets auto-escalated
     * to OPERATIONS_MANAGER instead of just being counted as "flagged" - nobody handled it in
     * time, so it needs to leave the first-line queue automatically rather than silently sit.
     * Skipped if it's already been escalated (either mode) by a human, so this never clobbers an
     * in-flight escalation.
     */
    @Override public EscalationSummary escalateOverdueTickets() {
        List<SupportTicket> openTickets = supportTicketRepository.findByTicketStatus("OPEN");
        List<SupportTicket> changed = new ArrayList<>();
        List<SupportTicket> autoEscalated = new ArrayList<>();
        int escalated = 0, flagged = 0;
        for (SupportTicket ticket : openTickets) {
            long hoursOpen = Duration.between(ticket.getRaisedAt(), OffsetDateTime.now()).toHours();
            if (hoursOpen < slaThresholdHours(ticket.getPriority())) continue;
            String nextTier = nextPriorityTier(ticket.getPriority());
            if (nextTier == null) {
                flagged++;
                if (ticket.getEscalatedToRole() == null && ticket.getEscalatedToEntityType() == null) {
                    ticket.setEscalatedToRole("OPERATIONS_MANAGER");
                    ticket.setEscalationReason("Auto-escalated: SLA breached at HIGH priority");
                    ticket.setEscalatedAt(OffsetDateTime.now());
                    changed.add(ticket);
                    autoEscalated.add(ticket);
                }
                continue;
            }
            ticket.setPriority(nextTier);
            ticket.setDueBy(computeDueBy(nextTier, OffsetDateTime.now()));
            changed.add(ticket); escalated++;
        }
        supportTicketRepository.saveAll(changed);
        for (SupportTicket ticket : autoEscalated) {
            SupportTicketMessage note = new SupportTicketMessage();
            note.setCustomerTicketId(ticket.getCustomerTicketId());
            note.setSenderAccountId(null);
            note.setSenderRole("SYSTEM");
            note.setMessage("Ticket auto-escalated to OPERATIONS_MANAGER: SLA breached at HIGH priority");
            note.setInternalNote(true);
            note.setSentAt(OffsetDateTime.now());
            messageRepository.save(note);
            notify(ticket.getRaisedByAccountId(), "SUPPORT_TICKET_ESCALATED", "Your ticket has been escalated",
                    "Ticket " + ticket.getTicketNumber() + " (" + ticket.getSubject() + ") exceeded its response time and has been automatically escalated to Operations for review.",
                    ticket.getCustomerTicketId());
        }
        return new EscalationSummary(openTickets.size(), escalated, flagged);
    }

    /** LOW -> 72h, MEDIUM -> 24h, HIGH -> 4h; any other/unknown priority defaults to MEDIUM's threshold. */
    private long slaThresholdHours(String priority) {
        if ("LOW".equals(priority)) return 72;
        if ("HIGH".equals(priority)) return 4;
        return 24;
    }

    private OffsetDateTime computeDueBy(String priority, OffsetDateTime from) {
        return from.plusHours(slaThresholdHours(priority));
    }

    /** LOW -> MEDIUM -> HIGH; HIGH (or any value with no defined next tier) escalates no further. */
    private String nextPriorityTier(String priority) {
        if ("LOW".equals(priority)) return "MEDIUM";
        if ("MEDIUM".equals(priority)) return "HIGH";
        return null;
    }

    @Override public SupportTicketMessage addMessage(UUID ticketId, UUID senderAccountId, String senderRole, SupportTicketMessageRequest request) {
        SupportTicket ticket = getSupportTicketById(ticketId);
        boolean isStaff = STAFF_ROLES.contains(senderRole);
        boolean isRaiser = ticket.getRaisedByAccountId().equals(senderAccountId);
        boolean isEscalationTarget = com.lbos.finance.support.SupportTicketAccess.isEscalationTarget(ticket, senderRole);
        if (!isStaff && !isRaiser && !isEscalationTarget) {
            throw new ForbiddenActionException("You may only message a ticket you raised, or one escalated to you");
        }
        if (request.message() == null || request.message().isBlank()) {
            throw new BusinessRuleException("Message text is required");
        }
        if ("CLOSED".equals(ticket.getTicketStatus())) {
            throw new BusinessRuleException("Ticket " + ticketId + " is CLOSED and no longer accepts new messages");
        }
        SupportTicketMessage message = new SupportTicketMessage();
        message.setCustomerTicketId(ticketId);
        message.setSenderAccountId(senderAccountId);
        message.setSenderRole(senderRole);
        message.setMessage(request.message());
        // Only staff can leave an internal (raiser-invisible) note - a non-staff caller's
        // request is silently honored as a normal, visible message regardless of what it asked.
        message.setInternalNote(isStaff && request.internalNote());
        message.setSentAt(OffsetDateTime.now());
        return messageRepository.save(message);
    }

    @Override public List<SupportTicketMessage> getMessages(UUID ticketId, boolean includeInternalNotes) {
        List<SupportTicketMessage> all = messageRepository.findByCustomerTicketIdOrderBySentAtAsc(ticketId);
        if (includeInternalNotes) return all;
        return all.stream().filter(m -> !m.isInternalNote()).toList();
    }
}
