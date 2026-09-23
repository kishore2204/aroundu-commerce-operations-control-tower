import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PaymentTransaction, Settlement, SettlementRequest, SettlementUpdateRequest } from '../models/settlement.model';

@Injectable({ providedIn: 'root' })
export class SettlementService {
  constructor(private readonly http: HttpClient) {}

  list(): Observable<Settlement[]> {
    return this.http.get<Settlement[]>('/api/settlements');
  }

  create(request: SettlementRequest): Observable<Settlement> {
    return this.http.post<Settlement>('/api/settlements', request);
  }

  update(id: string, request: SettlementUpdateRequest): Observable<Settlement> {
    return this.http.put<Settlement>(`/api/settlements/${id}`, request);
  }

  complete(id: string): Observable<Settlement> {
    return this.http.post<Settlement>(`/api/settlements/${id}/complete`, {});
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/settlements/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class PaymentTransactionService {
  constructor(private readonly http: HttpClient) {}

  list(): Observable<PaymentTransaction[]> {
    return this.http.get<PaymentTransaction[]>('/api/payment-transactions');
  }

  /** Retries a disputed (FAILED) payment by opening a fresh PENDING transaction for the same
   *  order/method - a FAILED transaction doesn't block a new one (see S6's
   *  PaymentTransactionServiceImpl), so this is how an Operations Manager rectifies it. */
  retry(orderId: number, paymentMethod: string): Observable<PaymentTransaction> {
    return this.http.post<PaymentTransaction>('/api/payment-transactions', { orderId, paymentMethod });
  }
}
