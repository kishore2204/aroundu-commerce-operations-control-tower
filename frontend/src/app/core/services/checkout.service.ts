import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiResponse, unwrap } from '../api/api-response';
import { CheckoutRequest, CheckoutSummary } from '../models/checkout.model';

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  constructor(private readonly http: HttpClient) {}

  /**
   * Known backend gap: internally calls S4 for delivery serviceability, and S4
   * does not implement the matching endpoint yet - this call is expected to
   * fail today. See docs/ui-api-mapping.md "Confirmed live gap".
   */
  prepare(request: CheckoutRequest): Observable<CheckoutSummary> {
    return this.http
      .post<ApiResponse<CheckoutSummary>>('/api/v1/checkout/prepare', request)
      .pipe(map(unwrap));
  }

  /**
   * Same computation as prepare(), but this is the one call that actually commits the reward-
   * points balance change - call it exactly once, right after every retailer order for this
   * checkout has been created (and before the cart is cleared). prepare() itself never persists
   * anything, however many times it's called (see CheckoutServiceImpl.prepare()/confirm()).
   */
  confirm(request: CheckoutRequest): Observable<CheckoutSummary> {
    return this.http
      .post<ApiResponse<CheckoutSummary>>('/api/v1/checkout/confirm', request)
      .pipe(map(unwrap));
  }
}
