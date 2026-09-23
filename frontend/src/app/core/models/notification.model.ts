/** S6 owns Notification/SupportTicket. GET (list/mine/{id}), POST, and PUT on
 *  /api/support-tickets are open to any authenticated role; assign/resolve/close/escalate are
 *  staff-only (SUPER_ADMIN/OPERATIONS_MANAGER/SUPPORT_STAFF/LOCATION_MANAGER) - see
 *  S6's SecurityConfig. */
export interface Notification {
  notificationId: number;
  userAccountId: string;
  role: string;
  notificationType: string;
  referenceType: string;
  referenceId: string;
  title: string;
  message: string;
  read: boolean;
  sentAt: string;
}

/** S6 NotificationRequest */
export interface NotificationRequest {
  userAccountId: string;
  role?: string | null;
  notificationType: string;
  referenceType?: string | null;
  referenceId?: string | null;
  title: string;
  message: string;
}

/**
 * raisedByRole is a snapshot of the raiser's role at creation time - drives which
 * category/subcategory taxonomy applied (see support-ticket-categories.ts) and which shared
 * ticket-detail/queue screens the ticket shows up in. customerProfileId is only ever set when
 * raisedByRole is 'CUSTOMER'. escalatedToRole/escalatedByAccountId/escalationReason/escalatedAt
 * are set once a staff handler hands the ticket to a specific responsible role.
 */
export interface SupportTicket {
  customerTicketId: string;
  customerProfileId: string | null;
  orderId: number | null;
  raisedByAccountId: string;
  raisedByRole: string;
  ticketCategory: string;
  ticketSubCategory: string | null;
  assignedSupportAccountId: string | null;
  ticketNumber: string;
  subject: string;
  description: string;
  priority: string;
  ticketStatus: string;
  escalatedToRole: string | null;
  /** "RETAILER" | "FLEET_OWNER" - set instead of escalatedToRole when the ticket was escalated
   *  directly to the specific business it's about, rather than a broad internal role. */
  escalatedToEntityType: 'RETAILER' | 'FLEET_OWNER' | null;
  escalatedToEntityId: string | null;
  escalatedByAccountId: string | null;
  escalationReason: string | null;
  escalatedAt: string | null;
  raisedAt: string;
  resolvedAt: string | null;
  /** SLA deadline, computed server-side from priority at creation/priority-change time. */
  dueBy: string | null;
}

/** S6 DriverComplaintSummary - GET /api/support-tickets/mine-as-driver. Privacy-safe subset:
 *  deliberately no raisedByAccountId/description/internal notes, since a driver isn't staff and
 *  isn't the ticket's own raiser. */
export interface DriverComplaintSummary {
  ticketNumber: string;
  subject: string;
  ticketCategory: string;
  ticketStatus: string;
  escalatedAt: string | null;
  resolvedAt: string | null;
  dueBy: string | null;
}

export interface SupportTicketUpdateRequest {
  subject?: string;
  description?: string;
  priority?: string;
}

/** customerProfileId is required only when raisedByRole is 'CUSTOMER' - every other role has
 *  no customer_profile row to reference. */
export interface SupportTicketRequest {
  customerProfileId?: string | null;
  orderId?: number | null;
  raisedByAccountId: string;
  raisedByRole: string;
  ticketCategory: string;
  ticketSubCategory: string;
  ticketNumber: string;
  subject: string;
  description: string;
  priority: string;
}

/** Exactly one of (toRole) or (toEntityType + toEntityId) must be set - see
 *  TicketDetailComponent's escalation form mode toggle. */
export interface SupportTicketEscalateRequest {
  toRole?: string | null;
  toEntityType?: 'RETAILER' | 'FLEET_OWNER' | null;
  toEntityId?: string | null;
  reason: string;
}

export interface SupportTicketMessageRequest {
  message: string;
  internalNote: boolean;
}

/** internalNote messages are only ever visible to staff - GET .../messages already filters
 *  them out server-side for a non-staff viewer, so the frontend never has to hide them itself. */
export interface SupportTicketMessage {
  supportTicketMessageId: string;
  customerTicketId: string;
  senderAccountId: string;
  senderRole: string;
  message: string;
  internalNote: boolean;
  sentAt: string;
}
