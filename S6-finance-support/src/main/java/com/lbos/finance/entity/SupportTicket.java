package com.lbos.finance.entity;
import java.util.UUID;
import java.time.OffsetDateTime;
import jakarta.persistence.*;
/** Indexed on the columns SupportTicketRepository's finders (byStatus, mine, escalated-to-role,
 *  escalated-to-entity, by order, and the SLA/cluster sweeps' status+raised_at range scan)
 *  actually filter/sort on - none of these had an index before. */
@Entity
@Table(name = "support_ticket", indexes = {
        @Index(name = "idx_support_ticket_status", columnList = "ticket_status"),
        @Index(name = "idx_support_ticket_raised_by", columnList = "raised_by_account_id"),
        @Index(name = "idx_support_ticket_escalated_to_role", columnList = "escalated_to_role"),
        @Index(name = "idx_support_ticket_escalated_to_entity", columnList = "escalated_to_entity_type, escalated_to_entity_id"),
        @Index(name = "idx_support_ticket_order_id", columnList = "order_id"),
        @Index(name = "idx_support_ticket_status_raised_at", columnList = "ticket_status, raised_at"),
})
public class SupportTicket {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID customerTicketId;
    private UUID customerProfileId;
    private Long orderId;
    private UUID raisedByAccountId;
    private String raisedByRole;
    private String ticketCategory;
    private String ticketSubCategory;
    private UUID assignedSupportAccountId;
    private String ticketNumber;
    private String subject;
    private String description;
    private String priority;
    private String ticketStatus;
    private String escalatedToRole;
    private String escalatedToEntityType;
    private UUID escalatedToEntityId;
    private UUID escalatedByAccountId;
    private String escalationReason;
    private OffsetDateTime escalatedAt;
    private OffsetDateTime raisedAt;
    private OffsetDateTime resolvedAt;
    private OffsetDateTime dueBy;
    /** Set by the ticket-cluster sweep the first time this ticket is linked to an incident. */
    private UUID clusterIncidentId;
    public UUID getClusterIncidentId() { return clusterIncidentId; }
    public void setClusterIncidentId(UUID clusterIncidentId) { this.clusterIncidentId = clusterIncidentId; }
    public UUID getCustomerTicketId() { return customerTicketId; }
    public void setCustomerTicketId(UUID customerTicketId) { this.customerTicketId = customerTicketId; }
    public UUID getCustomerProfileId() { return customerProfileId; }
    public void setCustomerProfileId(UUID customerProfileId) { this.customerProfileId = customerProfileId; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public UUID getRaisedByAccountId() { return raisedByAccountId; }
    public void setRaisedByAccountId(UUID raisedByAccountId) { this.raisedByAccountId = raisedByAccountId; }
    public String getRaisedByRole() { return raisedByRole; }
    public void setRaisedByRole(String raisedByRole) { this.raisedByRole = raisedByRole; }
    public String getTicketCategory() { return ticketCategory; }
    public void setTicketCategory(String ticketCategory) { this.ticketCategory = ticketCategory; }
    public String getTicketSubCategory() { return ticketSubCategory; }
    public void setTicketSubCategory(String ticketSubCategory) { this.ticketSubCategory = ticketSubCategory; }
    public UUID getAssignedSupportAccountId() { return assignedSupportAccountId; }
    public void setAssignedSupportAccountId(UUID assignedSupportAccountId) { this.assignedSupportAccountId = assignedSupportAccountId; }
    public String getTicketNumber() { return ticketNumber; }
    public void setTicketNumber(String ticketNumber) { this.ticketNumber = ticketNumber; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public String getTicketStatus() { return ticketStatus; }
    public void setTicketStatus(String ticketStatus) { this.ticketStatus = ticketStatus; }
    public String getEscalatedToRole() { return escalatedToRole; }
    public void setEscalatedToRole(String escalatedToRole) { this.escalatedToRole = escalatedToRole; }
    public String getEscalatedToEntityType() { return escalatedToEntityType; }
    public void setEscalatedToEntityType(String escalatedToEntityType) { this.escalatedToEntityType = escalatedToEntityType; }
    public UUID getEscalatedToEntityId() { return escalatedToEntityId; }
    public void setEscalatedToEntityId(UUID escalatedToEntityId) { this.escalatedToEntityId = escalatedToEntityId; }
    public UUID getEscalatedByAccountId() { return escalatedByAccountId; }
    public void setEscalatedByAccountId(UUID escalatedByAccountId) { this.escalatedByAccountId = escalatedByAccountId; }
    public String getEscalationReason() { return escalationReason; }
    public void setEscalationReason(String escalationReason) { this.escalationReason = escalationReason; }
    public OffsetDateTime getEscalatedAt() { return escalatedAt; }
    public void setEscalatedAt(OffsetDateTime escalatedAt) { this.escalatedAt = escalatedAt; }
    public OffsetDateTime getRaisedAt() { return raisedAt; }
    public void setRaisedAt(OffsetDateTime raisedAt) { this.raisedAt = raisedAt; }
    public OffsetDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(OffsetDateTime resolvedAt) { this.resolvedAt = resolvedAt; }
    public OffsetDateTime getDueBy() { return dueBy; }
    public void setDueBy(OffsetDateTime dueBy) { this.dueBy = dueBy; }
}
