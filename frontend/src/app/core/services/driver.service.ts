import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AddDriverRequest, AddDriverResult, Driver } from '../models/driver.model';

const MY_DRIVER_IDS_KEY = 'aroundu.myDriverIds';

@Injectable({ providedIn: 'root' })
export class DriverService {
  constructor(private readonly http: HttpClient) {}

  add(fleetOwnerId: string, request: AddDriverRequest): Observable<Driver> {
    return this.http.post<Driver>('/api/drivers', { ...request, fleetOwnerId });
  }

  /** A freshly-created driver is INACTIVE with no open verification-queue entry - this is the
   *  separate, required step that actually sends it to a Location Manager for review (see
   *  DriverServiceImpl.submitForVerification()). Without calling this, a new driver never shows
   *  up in the verification queue at all. */
  submitForVerification(driverId: string, submittedByAccountId: string): Observable<{ verificationQueueId: string }> {
    return this.http.post<{ verificationQueueId: string }>(`/api/drivers/${driverId}/submit-for-verification`, {
      submittedByAccountId,
    });
  }


  /**
   * GET /api/drivers/{id} (single) is NOT part of S5's list-all-is-staff-only restriction -
   * only the no-id GET /api/drivers is. So a fetch-by-id, fed by rememberDriverId()'s
   * client-tracked ids, is how "my drivers" gets built - see OrderService for the identical
   * pattern and why (no server-side "list mine" exists for this resource either).
   */
  get(id: string): Observable<Driver> {
    return this.http.get<Driver>(`/api/drivers/${id}`);
  }

  /** This fleet owner's own drivers (GET /api/drivers/mine?fleetOwnerId=). */
  mine(fleetOwnerId: string): Observable<Driver[]> {
    const params = new HttpParams().set('fleetOwnerId', fleetOwnerId);
    return this.http.get<Driver[]>('/api/drivers/mine', { params });
  }

  /** Driver-app self-lookup: the authenticated driver's own record (GET /api/drivers/me). */
  me(): Observable<Driver> {
    return this.http.get<Driver>('/api/drivers/me');
  }

  /** Driver-app self-service profile edit (PUT /api/drivers/me) - license number/expiry only. */
  updateMe(licenseNumber: string, licenseExpiryDate: string): Observable<Driver> {
    return this.http.put<Driver>('/api/drivers/me', { licenseNumber, licenseExpiryDate });
  }

  rememberDriverId(driverId: string): void {
    const ids = this.myDriverIds();
    if (!ids.includes(driverId)) {
      ids.unshift(driverId);
      localStorage.setItem(MY_DRIVER_IDS_KEY, JSON.stringify(ids));
    }
  }

  myDriverIds(): string[] {
    try {
      const raw = localStorage.getItem(MY_DRIVER_IDS_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }
}
