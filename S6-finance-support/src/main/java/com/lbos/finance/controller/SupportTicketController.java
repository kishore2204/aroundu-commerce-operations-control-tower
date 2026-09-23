package com.lbos.finance.controller;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;
import com.lbos.finance.dto.EscalationSummary;
import com.lbos.finance.dto.SupportTicketEscalateRequest;
import com.lbos.finance.dto.SupportTicketMessageRequest;
import com.lbos.finance.dto.SupportTicketRequest;
import com.lbos.finance.dto.SupportTicketUpdateRequest;
import com.lbos.finance.dto.TicketContext;
import com.lbos.finance.entity.SupportTicket;
import com.lbos.finance.entity.SupportTicketMessage;
import com.lbos.finance.exception.ForbiddenActionException;
import com.lbos.finance.service.SupportTicketService;
import com.lbos.finance.support.SupportTicketAccess;
import com.lbos.finance.integration.client.LogisticsServiceClient;
import com.lbos.finance.integration.dto.TripResponse;

@RestController @RequestMapping("/api/support-tickets")
public class SupportTicketController {
    private static final Set<String> STAFF_ROLES = Set.of("SUPER_ADMIN", "OPERATIONS_MANAGER", "SUPPORT_STAFF", "LOCATION_MANAGER");

    private final SupportTicketService supportTicketService;
    private final LogisticsServiceClient logisticsServiceClient;
    public SupportTicketController(SupportTicketService supportTicketService, LogisticsServiceClient logisticsServiceClient) {
        this.supportTicketService = supportTicketService;
        this.logisticsServiceClient = logisticsServiceClient;
    }

    @PostMapping public SupportTicket createSupportTicket(@RequestBody SupportTicketRequest request) { return supportTicketService.createSupportTicket(request); }

    /** Staff-only (list-all is not scoped to any one requester) - see SecurityConfig. */
    @GetMapping public List<SupportTicket> getAllSupportTickets() { return supportTicketService.getAllSupportTickets(); }

    /** Returns only the authenticated user's own tickets, using the JWT subject (raisedByAccountId) to filter server-side. */
    @GetMapping("/mine") public List<SupportTicket> getMyTickets(Authentication authentication) { return supportTicketService.getMyTickets(resolveUserAccountId(authentication)); }

    /** Privacy-safe "complaints on my trips" view for the authenticated driver - not the full
     *  ticket, since a driver isn't staff and isn't the ticket's own raiser. */
    @GetMapping("/mine-as-driver") public List<com.lbos.finance.dto.DriverComplaintSummary> getMyComplaintsAsDriver(Authentication authentication) {
        return supportTicketService.getComplaintsForDriverUserAccount(resolveUserAccountId(authentication));
    }

    /** A staff role's own escalation queue - tickets handed to their role for action. */
    @GetMapping("/escalated-to-me") public List<SupportTicket> getEscalatedToMe(Authentication authentication) {
        return supportTicketService.getTicketsEscalatedToRole(resolveRole(authentication));
    }

    /** A retailer's or fleet owner's own "escalated to me" queue - see SecurityConfig for the
     *  role gate; entityId is trusted from the caller (same "not cross-checked against JWT
     *  subject" trust model as mineForRetailer/expenses/mine elsewhere in this codebase). */
    @GetMapping("/escalated-to-entity") public List<SupportTicket> getEscalatedToEntity(
            @RequestParam String entityType, @RequestParam UUID entityId) {
        return supportTicketService.getTicketsEscalatedToEntity(entityType, entityId);
    }

    @GetMapping("/{id}") public SupportTicket getSupportTicketById(@PathVariable UUID id, Authentication authentication) {
        SupportTicket ticket = supportTicketService.getSupportTicketById(id);
        requireOwnerOrStaff(ticket, authentication);
        return ticket;
    }

    @PutMapping("/{id}") public SupportTicket updateSupportTicket(@PathVariable UUID id, @RequestBody SupportTicketUpdateRequest request, Authentication authentication) {
        SupportTicket ticket = supportTicketService.getSupportTicketById(id);
        requireOwnerOrStaff(ticket, authentication);
        return supportTicketService.updateSupportTicket(id, request);
    }

    @PostMapping("/{id}/assign") public SupportTicket assign(@PathVariable UUID id, @RequestBody Map<String, UUID> body) { return supportTicketService.assignTicket(id, body.get("supportAccountId")); }
    @PostMapping("/{id}/resolve") public SupportTicket resolve(@PathVariable UUID id) { return supportTicketService.resolveTicket(id); }
    @PostMapping("/{id}/close") public SupportTicket close(@PathVariable UUID id) { return supportTicketService.closeTicket(id); }

    @PostMapping("/{id}/escalate") public SupportTicket escalate(@PathVariable UUID id, @RequestBody SupportTicketEscalateRequest request, Authentication authentication) {
        return supportTicketService.escalateTicket(id, request.toRole(), request.toEntityType(), request.toEntityId(), request.reason(), resolveUserAccountId(authentication));
    }

    @DeleteMapping("/{id}") public void deleteSupportTicket(@PathVariable UUID id) { supportTicketService.deleteSupportTicket(id); }
    @PostMapping("/escalate-overdue") public EscalationSummary escalateOverdueTickets() { return supportTicketService.escalateOverdueTickets(); }

    @PostMapping("/{id}/messages") public SupportTicketMessage addMessage(@PathVariable UUID id, @RequestBody SupportTicketMessageRequest request, Authentication authentication) {
        return supportTicketService.addMessage(id, resolveUserAccountId(authentication), resolveRole(authentication), request);
    }

    @GetMapping("/{id}/messages") public List<SupportTicketMessage> getMessages(@PathVariable UUID id, Authentication authentication) {
        SupportTicket ticket = supportTicketService.getSupportTicketById(id);
        boolean isStaff = STAFF_ROLES.contains(resolveRole(authentication));
        requireOwnerOrStaff(ticket, authentication);
        return supportTicketService.getMessages(id, isStaff);
    }

    /**
     * The driver's delivery-proof photo/note for this ticket's order (e.g. for a "product came
     * damaged" claim, so staff can see what the driver recorded at drop-off without leaving the
     * ticket). Best-effort, like every other S6->S4 lookup in this codebase: a ticket with no
     * orderId, or a trip that can't be found/reached, just returns a null proof rather than
     * failing the whole ticket view.
     */
    @GetMapping("/{id}/delivery-proof") public Map<String, Object> getDeliveryProof(@PathVariable UUID id, Authentication authentication) {
        SupportTicket ticket = supportTicketService.getSupportTicketById(id);
        requireOwnerOrStaff(ticket, authentication);
        if (ticket.getOrderId() == null) {
            return Map.of();
        }
        try {
            TripResponse trip = logisticsServiceClient.getTripByOrderId(ticket.getOrderId());
            if (trip == null || trip.proofOfDelivery() == null) {
                return Map.of();
            }
            return Map.of("tripId", trip.tripId(), "driverId", trip.driverId(), "proofOfDelivery", trip.proofOfDelivery());
        } catch (Exception tripLookupFailure) {
            return Map.of();
        }
    }

    /**
     * The driver's/general order context (order status, items, trip, raising customer's
     * profile) for this ticket, so an agent - or the retailer/fleet owner it's been escalated
     * to - never has to leave the ticket to look this up. Same access as the ticket itself.
     */
    @GetMapping("/{id}/context") public TicketContext getTicketContext(@PathVariable UUID id, Authentication authentication) {
        SupportTicket ticket = supportTicketService.getSupportTicketById(id);
        requireOwnerOrStaff(ticket, authentication);
        return supportTicketService.getTicketContext(id);
    }

    private void requireOwnerOrStaff(SupportTicket ticket, Authentication authentication) {
        UUID callerId = resolveUserAccountId(authentication);
        String role = resolveRole(authentication);
        if (STAFF_ROLES.contains(role)) return;
        if (ticket.getRaisedByAccountId().equals(callerId)) return;
        if (SupportTicketAccess.isEscalationTarget(ticket, role)) return;
        throw new ForbiddenActionException("You do not have access to this ticket");
    }

    private UUID resolveUserAccountId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new IllegalStateException("No authenticated user on this request");
        }
        try {
            return UUID.fromString(authentication.getName());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("Authenticated subject is not a valid user account id");
        }
    }

    private String resolveRole(Authentication authentication) {
        if (authentication == null) {
            throw new IllegalStateException("No authenticated user on this request");
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(authority -> authority.startsWith("ROLE_"))
                .map(authority -> authority.substring("ROLE_".length()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Authenticated user has no role"));
    }
}
