package com.lbos.finance.entity;
import java.util.UUID;
import java.time.OffsetDateTime;
import jakarta.persistence.*;

/** Indexed on customer_ticket_id - the FK behind every "messages for this ticket" lookup, which had no index before. */
@Entity
@Table(name = "support_ticket_message", indexes = @Index(name = "idx_support_ticket_message_ticket_id", columnList = "customer_ticket_id"))
public class SupportTicketMessage {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID supportTicketMessageId;
    private UUID customerTicketId;
    private UUID senderAccountId;
    private String senderRole;
    private String message;
    private boolean internalNote;
    private OffsetDateTime sentAt;

    public UUID getSupportTicketMessageId() { return supportTicketMessageId; }
    public void setSupportTicketMessageId(UUID supportTicketMessageId) { this.supportTicketMessageId = supportTicketMessageId; }
    public UUID getCustomerTicketId() { return customerTicketId; }
    public void setCustomerTicketId(UUID customerTicketId) { this.customerTicketId = customerTicketId; }
    public UUID getSenderAccountId() { return senderAccountId; }
    public void setSenderAccountId(UUID senderAccountId) { this.senderAccountId = senderAccountId; }
    public String getSenderRole() { return senderRole; }
    public void setSenderRole(String senderRole) { this.senderRole = senderRole; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public boolean isInternalNote() { return internalNote; }
    public void setInternalNote(boolean internalNote) { this.internalNote = internalNote; }
    public OffsetDateTime getSentAt() { return sentAt; }
    public void setSentAt(OffsetDateTime sentAt) { this.sentAt = sentAt; }
}
