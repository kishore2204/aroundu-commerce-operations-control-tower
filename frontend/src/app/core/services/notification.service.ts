import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DriverComplaintSummary,
  Notification,
  NotificationPopup,
  NotificationRequest,
  SupportTicket,
  SupportTicketEscalateRequest,
  SupportTicketMessage,
  SupportTicketMessageRequest,
  SupportTicketRequest,
  SupportTicketUpdateRequest,
} from '../models/notification.model';
import { TicketContext } from '../models/support-context.model';

/**
 * GET /api/notifications (list-all) and GET /api/support-tickets (list-all) below are
 * staff-facing (used by the operations support console) - any authenticated user CAN call
 * them per S6's SecurityConfig, but callers wanting only their own rows should use mine()
 * on each service instead, which is scoped server-side from the JWT.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private readonly http: HttpClient) {}

  all(): Observable<Notification[]> {
    return this.http.get<Notification[]>('/api/notifications');
  }

  /** The authenticated user's own notifications (GET /api/notifications/mine), scoped server-side. */
  mine(): Observable<Notification[]> {
    return this.http.get<Notification[]>('/api/notifications/mine');
  }

  /** The bell popup: the newest few UNREAD notifications and the unread total - never the whole history. */
  popup(): Observable<NotificationPopup> {
    return this.http.get<NotificationPopup>('/api/notifications/mine/popup');
  }

  /** "Clear" in the popup: marks the caller's unread notifications as read (they stay in the full list on the profile page). */
  clearMine(): Observable<{ cleared: number }> {
    return this.http.patch<{ cleared: number }>('/api/notifications/mine/clear', {});
  }

  create(request: NotificationRequest): Observable<Notification> {
    return this.http.post<Notification>('/api/notifications', request);
  }

  markRead(id: number): Observable<void> {
    return this.http.patch<void>(`/api/notifications/${id}/read`, {});
  }
}

@Injectable({ providedIn: 'root' })
export class SupportService {
  constructor(private readonly http: HttpClient) {}

  create(request: SupportTicketRequest): Observable<SupportTicket> {
    return this.http.post<SupportTicket>('/api/support-tickets', request);
  }

  list(): Observable<SupportTicket[]> {
    return this.http.get<SupportTicket[]>('/api/support-tickets');
  }

  /** The authenticated user's own tickets (GET /api/support-tickets/mine), scoped server-side. */
  mine(): Observable<SupportTicket[]> {
    return this.http.get<SupportTicket[]>('/api/support-tickets/mine');
  }

  /** Privacy-safe "complaints on my trips" view for the authenticated driver. */
  mineAsDriver(): Observable<DriverComplaintSummary[]> {
    return this.http.get<DriverComplaintSummary[]>('/api/support-tickets/mine-as-driver');
  }

  /** This staff member's own escalation queue - tickets handed to their role for action. */
  escalatedToMe(): Observable<SupportTicket[]> {
    return this.http.get<SupportTicket[]>('/api/support-tickets/escalated-to-me');
  }

  /** A retailer's/fleet owner's own "escalated to me" queue - see EntityTicketQueueComponent. */
  escalatedToEntity(entityType: 'RETAILER' | 'FLEET_OWNER', entityId: string): Observable<SupportTicket[]> {
    const params = new HttpParams().set('entityType', entityType).set('entityId', entityId);
    return this.http.get<SupportTicket[]>('/api/support-tickets/escalated-to-entity', { params });
  }

  /** Consolidated order/items/trip/customer context for a ticket's linked order, if any. */
  getContext(id: string): Observable<TicketContext> {
    return this.http.get<TicketContext>(`/api/support-tickets/${id}/context`);
  }

  get(id: string): Observable<SupportTicket> {
    return this.http.get<SupportTicket>(`/api/support-tickets/${id}`);
  }

  update(id: string, request: SupportTicketUpdateRequest): Observable<SupportTicket> {
    return this.http.put<SupportTicket>(`/api/support-tickets/${id}`, request);
  }

  assign(id: string, supportAccountId: string): Observable<SupportTicket> {
    return this.http.post<SupportTicket>(`/api/support-tickets/${id}/assign`, { supportAccountId });
  }

  resolve(id: string): Observable<SupportTicket> {
    return this.http.post<SupportTicket>(`/api/support-tickets/${id}/resolve`, {});
  }

  close(id: string): Observable<SupportTicket> {
    return this.http.post<SupportTicket>(`/api/support-tickets/${id}/close`, {});
  }

  /** Hands an IN_PROGRESS ticket to a specific responsible role (see SupportTicketEscalateRequest). */
  escalate(id: string, request: SupportTicketEscalateRequest): Observable<SupportTicket> {
    return this.http.post<SupportTicket>(`/api/support-tickets/${id}/escalate`, request);
  }

  /** The ticket's conversation thread - internal notes are already filtered out server-side for a non-staff viewer. */
  getMessages(id: string): Observable<SupportTicketMessage[]> {
    return this.http.get<SupportTicketMessage[]>(`/api/support-tickets/${id}/messages`);
  }

  addMessage(id: string, request: SupportTicketMessageRequest): Observable<SupportTicketMessage> {
    return this.http.post<SupportTicketMessage>(`/api/support-tickets/${id}/messages`, request);
  }

  /** The driver's delivery-proof photo/note for this ticket's order, if any (e.g. for an
   *  ITEM_DAMAGED claim) - {} when the ticket has no order or no trip proof was recorded. */
  getDeliveryProof(id: string): Observable<{ tripId?: string; driverId?: string; proofOfDelivery?: string }> {
    return this.http.get<{ tripId?: string; driverId?: string; proofOfDelivery?: string }>(
      `/api/support-tickets/${id}/delivery-proof`,
    );
  }
}
