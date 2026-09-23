import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CreateLogisticsBookingRequest,
  LogisticsBookingDetail,
  LogisticsQuote,
  LogisticsQuoteRequest,
} from '../models/logistics-booking.model';

@Injectable({ providedIn: 'root' })
export class LogisticsBookingService {
  constructor(private readonly http: HttpClient) {}

  create(request: CreateLogisticsBookingRequest): Observable<LogisticsBookingDetail> {
    return this.http.post<LogisticsBookingDetail>('/api/logistics-bookings', request);
  }

  /** The price of a booking before it is created - the amount shown on the payment screen, charged, and shown on the order. */
  quote(request: LogisticsQuoteRequest): Observable<LogisticsQuote> {
    return this.http.post<LogisticsQuote>('/api/logistics-bookings/quote', request);
  }

  get(orderId: number): Observable<LogisticsBookingDetail> {
    return this.http.get<LogisticsBookingDetail>(`/api/logistics-bookings/${orderId}`);
  }
}
