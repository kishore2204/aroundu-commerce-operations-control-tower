import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, catchError, finalize, of, shareReplay, tap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { FleetOwner, FleetOwnerRequest } from '../models/fleet-owner.model';
import { VerificationDocumentRequest, VerificationStatusResponse } from '../models/retailer.model';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/** Mirrors RetailerService - same S2 controller shape. */
@Injectable({ providedIn: 'root' })
export class FleetOwnerService {
  readonly myFleetOwner = signal<FleetOwner | null>(null);
  private resolveMineInFlight: Observable<FleetOwner | null> | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
  ) {}

  register(request: FleetOwnerRequest): Observable<FleetOwner> {
    return this.http
      .post<FleetOwner>('/api/fleet-owners/register', request)
      .pipe(tap((owner) => this.myFleetOwner.set(owner)));
  }

  get(fleetOwnerId: string): Observable<FleetOwner> {
    return this.http
      .get<FleetOwner>(`/api/fleet-owners/${fleetOwnerId}`)
      .pipe(tap((owner) => this.myFleetOwner.set(owner)));
  }

  update(fleetOwnerId: string, request: FleetOwnerRequest): Observable<FleetOwner> {
    return this.http
      .put<FleetOwner>(`/api/fleet-owners/${fleetOwnerId}`, request)
      .pipe(tap((owner) => this.myFleetOwner.set(owner)));
  }

  /**
   * GET /api/fleet-owners/me resolves the caller's own profile directly by userAccountId (a
   * single indexed-by-id row, not a list) - mirrors RetailerService.resolveMine(), including the
   * shareReplay(1) in-flight dedup (see its comment): the route guard and the destination
   * component both call resolveMine() on the same navigation before either populates
   * `myFleetOwner`.
   */
  resolveMine(): Observable<FleetOwner | null> {
    const userAccountId = this.auth.userAccountId();
    if (this.myFleetOwner() && this.myFleetOwner()?.userAccountId === userAccountId) {
      return of(this.myFleetOwner());
    }
    if (this.resolveMineInFlight) return this.resolveMineInFlight;
    this.resolveMineInFlight = this.http.get<FleetOwner>('/api/fleet-owners/me').pipe(
      tap((owner) => this.myFleetOwner.set(owner)),
      catchError((err) => (err?.status === 404 ? of(null) : throwError(() => err))),
      finalize(() => { this.resolveMineInFlight = null; }),
      shareReplay(1),
    );
    return this.resolveMineInFlight;
  }

  /** Returns the verification queue id these documents were attached to - follow up with
   *  VerificationDocumentService.upload() for each document that has a real file, since this
   *  metadata-only call never stores actual file bytes. */
  submitDocuments(fleetOwnerId: string, documents: VerificationDocumentRequest[]): Observable<{ verificationQueueId: string }> {
    const payload = documents.map((d) => ({
      verificationQueueId: NIL_UUID,
      documentStatus: 'PENDING',
      versionNumber: 1,
      ...d,
    }));
    return this.http.post<{ verificationQueueId: string }>(`/api/fleet-owners/${fleetOwnerId}/documents`, payload);
  }

  submitForVerification(fleetOwnerId: string): Observable<void> {
    return this.http.post<void>(`/api/fleet-owners/${fleetOwnerId}/submit-verification`, {});
  }

  verificationStatus(fleetOwnerId: string): Observable<VerificationStatusResponse> {
    return this.http.get<VerificationStatusResponse>(`/api/fleet-owners/${fleetOwnerId}/verification-status`);
  }
}
