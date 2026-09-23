import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, finalize, map, shareReplay, tap } from 'rxjs';
import { ApiResponse, PageResponse, unwrap } from '../api/api-response';
import { TtlCache } from '../api/ttl-cache';
import { AuthService } from '../auth/auth.service';
import { Address, AddressRequest } from '../models/address.model';

@Injectable({ providedIn: 'root' })
export class AddressService {
  /** The header's address menu (and the address screens) ask for the same list again and again. It is the CUSTOMER'S OWN
   *  data, so the key includes the signed-in account - another account never sees it - and it is dropped the moment
   *  anything writes an address (create / update / delete / default change) and after a short time anyway. */
  private readonly lists = new TtlCache<string, PageResponse<Address>>(2 * 60_000, 20);
  private defaultInFlight: Observable<Address> | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
  ) {}

  list(page = 0, size = 20): Observable<PageResponse<Address>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.lists.get(`${this.auth.userAccountId() ?? 'anonymous'}:${page}:${size}`, () =>
      this.http
        .get<ApiResponse<PageResponse<Address>>>('/api/v1/customers/me/addresses', { params })
        .pipe(map(unwrap)),
    );
  }

  /** Forget the remembered lists - the next `list()` asks the server. */
  invalidate(): void {
    this.lists.clear();
  }

  get(id: string): Observable<Address> {
    return this.http
      .get<ApiResponse<Address>>(`/api/v1/customers/me/addresses/${id}`)
      .pipe(map(unwrap));
  }

  /**
   * Never time-cached (the default address can change from a setDefault() elsewhere in the same
   * session) - every call still asks the server fresh. Only concurrent callers within the same
   * request cycle share one HTTP request: the shell's own getDefault() (for CustomerZoneService)
   * and a freshly-landed page's own getDefault() (e.g. CheckoutComponent) otherwise both fire on
   * the same page load - confirmed via a live network trace showing two identical
   * GET .../addresses/default requests when landing directly on /checkout.
   */
  getDefault(): Observable<Address> {
    if (this.defaultInFlight) return this.defaultInFlight;
    this.defaultInFlight = this.http
      .get<ApiResponse<Address>>('/api/v1/customers/me/addresses/default')
      .pipe(
        map(unwrap),
        finalize(() => { this.defaultInFlight = null; }),
        shareReplay(1),
      );
    return this.defaultInFlight;
  }

  create(request: AddressRequest): Observable<Address> {
    return this.http
      .post<ApiResponse<Address>>('/api/v1/customers/me/addresses', request)
      .pipe(map(unwrap), tap(() => this.invalidate()));
  }

  update(id: string, request: AddressRequest): Observable<Address> {
    return this.http
      .patch<ApiResponse<Address>>(`/api/v1/customers/me/addresses/${id}`, request)
      .pipe(map(unwrap), tap(() => this.invalidate()));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/customers/me/addresses/${id}`).pipe(tap(() => this.invalidate()));
  }

  setDefault(id: string): Observable<Address> {
    return this.http
      .put<ApiResponse<Address>>(`/api/v1/customers/me/addresses/${id}/default`, {})
      .pipe(map(unwrap), tap(() => this.invalidate()));
  }
}
