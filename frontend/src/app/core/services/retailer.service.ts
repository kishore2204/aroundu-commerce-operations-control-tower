import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ApiResponse, unwrap } from '../api/api-response';
import {
  Retailer,
  RetailerRatingSummary,
  RetailerRequest,
  RetailerSummary,
  VerificationDocumentRequest,
  VerificationStatusResponse,
} from '../models/retailer.model';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

@Injectable({ providedIn: 'root' })
export class RetailerService {
  /** Cached for the session once resolved - see resolveMine(). */
  readonly myRetailer = signal<Retailer | null>(null);
  private resolveMineInFlight: Observable<Retailer | null> | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
  ) {}

  register(request: RetailerRequest): Observable<Retailer> {
    return this.http
      .post<Retailer>('/api/retailers/register', request)
      .pipe(tap((retailer) => this.myRetailer.set(retailer)));
  }

  get(retailerId: string): Observable<Retailer> {
    return this.http
      .get<Retailer>(`/api/retailers/${retailerId}`)
      .pipe(tap((retailer) => this.myRetailer.set(retailer)));
  }

  update(retailerId: string, request: RetailerRequest): Observable<Retailer> {
    return this.http
      .put<Retailer>(`/api/retailers/${retailerId}`, request)
      .pipe(tap((retailer) => this.myRetailer.set(retailer)));
  }

  /**
   * GET /api/retailers/me resolves the caller's own profile directly by userAccountId (a single
   * indexed-by-id row, not a list). Cached in `myRetailer` for the rest of the session once found.
   * A fresh account with no retailer profile yet gets a 404, which resolves to null rather than
   * an error - the caller (e.g. onboarding) treats "no profile" as a normal, expected state.
   *
   * shareReplay(1) on the in-flight request matters here: retailerProfileGuard (route
   * activation) and the destination component's own ngOnInit both call resolveMine() on the
   * same navigation, before either has a chance to populate `myRetailer` - confirmed via a live
   * network trace showing two identical GET /api/retailers/me requests on one login. Without it,
   * each caller's `.subscribe()` would re-run this cold pipeline and fire its own request.
   */
  resolveMine(): Observable<Retailer | null> {
    const userAccountId = this.auth.userAccountId();
    if (this.myRetailer() && this.myRetailer()?.userAccountId === userAccountId) {
      return of(this.myRetailer());
    }
    if (this.resolveMineInFlight) return this.resolveMineInFlight;
    this.resolveMineInFlight = this.http.get<Retailer>('/api/retailers/me').pipe(
      tap((retailer) => this.myRetailer.set(retailer)),
      catchError((err) => (err?.status === 404 ? of(null) : throwError(() => err))),
      finalize(() => { this.resolveMineInFlight = null; }),
      shareReplay(1),
    );
    return this.resolveMineInFlight;
  }

  /** Returns the verification queue id these documents were attached to - follow up with
   *  VerificationDocumentService.upload() for each document that has a real file, since this
   *  metadata-only call never stores actual file bytes. */
  submitDocuments(retailerId: string, documents: VerificationDocumentRequest[]): Observable<{ verificationQueueId: string }> {
    const payload = documents.map((d) => ({
      verificationQueueId: NIL_UUID, // overwritten server-side; @NotNull on the DTO only
      documentStatus: 'PENDING', // overwritten server-side
      versionNumber: 1,
      ...d,
    }));
    return this.http.post<{ verificationQueueId: string }>(`/api/retailers/${retailerId}/documents`, payload);
  }

  submitForVerification(retailerId: string): Observable<void> {
    return this.http.post<void>(`/api/retailers/${retailerId}/submit-verification`, {});
  }

  verificationStatus(retailerId: string): Observable<VerificationStatusResponse> {
    return this.http.get<VerificationStatusResponse>(`/api/retailers/${retailerId}/verification-status`);
  }

  /**
   * S3-owned customer-facing shop summary (note the /api/v1/ prefix, unlike the /api/retailers/**
   * routes above which are all S2 and RETAILER/staff-only) - used by ShopDetailExpanderComponent.
   */
  getPublicSummary(retailerId: string): Observable<RetailerSummary> {
    return this.http
      .get<ApiResponse<RetailerSummary>>(`/api/v1/retailers/${retailerId}`)
      .pipe(map(unwrap));
  }

  /** Fetched lazily, only when a shop card is expanded - never on every product-list render. */
  ratingSummary(retailerId: string): Observable<RetailerRatingSummary> {
    return this.http
      .get<ApiResponse<RetailerRatingSummary>>(`/api/v1/retailers/${retailerId}/rating-summary`)
      .pipe(map(unwrap));
  }
}
