package com.lbos.finance.repository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.lbos.finance.entity.SupportTicket;
public interface SupportTicketRepository extends JpaRepository<SupportTicket, UUID> {
    /** Used to compute average ticket resolution time; only resolved tickets have both timestamps. */
    List<SupportTicket> findByResolvedAtIsNotNull();

    /** Used by the overdue-ticket escalation sweep, which only ever acts on still-OPEN tickets. */
    List<SupportTicket> findByTicketStatus(String ticketStatus);

    /** Used by the ticket-cluster sweep: still-live tickets raised within the rolling window. */
    List<SupportTicket> findByTicketStatusInAndRaisedAtAfter(List<String> ticketStatuses, OffsetDateTime raisedAfter);

    /** Tickets linked to a given cluster incident - backs the incident detail view. */
    List<SupportTicket> findByClusterIncidentId(UUID clusterIncidentId);

    /** Backs GET /api/support-tickets/mine - returns only tickets raised by a specific user. */
    List<SupportTicket> findByRaisedByAccountId(UUID raisedByAccountId);

    /** A staff role's escalation queue - tickets handed to this role because the original handler couldn't resolve them. */
    List<SupportTicket> findByEscalatedToRole(String escalatedToRole);

    /** A retailer's or fleet owner's own "escalated to me" queue - tickets handed to that
     *  specific business, not a broad internal role. */
    List<SupportTicket> findByEscalatedToEntityTypeAndEscalatedToEntityId(String escalatedToEntityType, UUID escalatedToEntityId);

    /** Backs the driver "my complaints" view - tickets tied to any order this driver has
     *  ever been assigned (SupportTicket has no driverId of its own). */
    List<SupportTicket> findByOrderIdIn(List<Long> orderIds);
}
