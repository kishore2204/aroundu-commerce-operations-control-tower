import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CustomerRefund, CustomerRefundRequest, RefundEligibility } from '../models/customer-refund.model';

@Injectable({ providedIn: 'root' })
export class CustomerRefundService {
  constructor(private readonly http: HttpClient) {}

  create(request: CustomerRefundRequest): Observable<CustomerRefund> {
    return this.http.post<CustomerRefund>('/api/customer-refunds', request);
  }

  /** Refund requests already logged against a given support ticket. */
  byTicket(customerTicketId: string): Observable<CustomerRefund[]> {
    return this.http.get<CustomerRefund[]>(`/api/customer-refunds/by-ticket/${customerTicketId}`);
  }

  /** Server-side ticket/order/payment/item eligibility. Angular does not duplicate these rules. */
  eligibility(customerTicketId: string): Observable<RefundEligibility> {
    return this.http.get<RefundEligibility>(`/api/customer-refunds/eligibility/by-ticket/${customerTicketId}`);
  }

  approve(id: string): Observable<CustomerRefund> {
    return this.http.post<CustomerRefund>(`/api/customer-refunds/${id}/approve`, {});
  }

  reject(id: string, reason?: string): Observable<CustomerRefund> {
    return this.http.post<CustomerRefund>(`/api/customer-refunds/${id}/reject`, reason ? { reason } : {});
  }

  complete(id: string): Observable<CustomerRefund> {
    return this.http.post<CustomerRefund>(`/api/customer-refunds/${id}/complete`, {});
  }
}
