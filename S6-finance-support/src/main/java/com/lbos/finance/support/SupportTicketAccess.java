package com.lbos.finance.support;

import com.lbos.finance.entity.SupportTicket;

/**
 * Shared by SupportTicketController (view/GET-messages access) and SupportTicketServiceImpl
 * (addMessage) so a retailer/fleet owner a ticket has been escalated TO can see and reply to
 * it - without either place re-implementing the role<->entityType mapping separately. Deliberately
 * a role-match check, not a per-business-id ownership check (no per-id cross-check that the
 * caller's own retailerId/fleetOwnerId equals escalatedToEntityId): this codebase already
 * accepts that trade-off elsewhere for single-object reads within a role (e.g. the verification
 * queue's detail view), while the corresponding LIST endpoint (getTicketsEscalatedToEntity) is
 * the one that's actually scoped to the caller's own business id.
 */
public final class SupportTicketAccess {

    private SupportTicketAccess() {
    }

    public static boolean isEscalationTarget(SupportTicket ticket, String callerRole) {
        String entityType = ticket.getEscalatedToEntityType();
        if (entityType == null) {
            return false;
        }
        return ("RETAILER".equals(callerRole) && "RETAILER".equals(entityType))
                || ("FLEET_MANAGER".equals(callerRole) && "FLEET_OWNER".equals(entityType));
    }
}
