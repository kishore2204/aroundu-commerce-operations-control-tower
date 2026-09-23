import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AddVehicleRequest, AddVehicleResult, Vehicle } from '../models/vehicle.model';

const MY_VEHICLE_IDS_KEY = 'aroundu.myVehicleIds';

@Injectable({ providedIn: 'root' })
export class VehicleService {
  constructor(private readonly http: HttpClient) {}

  add(fleetOwnerId: string, request: AddVehicleRequest): Observable<Vehicle> {
    return this.http.post<Vehicle>('/api/vehicles', { ...request, fleetOwnerId });
  }

  /** A freshly-created vehicle is INACTIVE with no open verification-queue entry - this is the
   *  separate, required step that actually sends it to a Location Manager for review (mirrors
   *  DriverService.submitForVerification()). */
  submitForVerification(vehicleId: string, submittedByAccountId: string): Observable<{ verificationQueueId: string }> {
    return this.http.post<{ verificationQueueId: string }>(`/api/vehicles/${vehicleId}/submit-for-verification`, {
      submittedByAccountId,
    });
  }


  /** GET /api/vehicles/{id} (single) works even though list-all is staff-only - see DriverService.get(). */
  get(id: string): Observable<Vehicle> {
    return this.http.get<Vehicle>(`/api/vehicles/${id}`);
  }

  /** This fleet owner's own vehicles (GET /api/vehicles/mine?fleetOwnerId=). */
  mine(fleetOwnerId: string): Observable<Vehicle[]> {
    const params = new HttpParams().set('fleetOwnerId', fleetOwnerId);
    return this.http.get<Vehicle[]>('/api/vehicles/mine', { params });
  }

  rememberVehicleId(vehicleId: string): void {
    const ids = this.myVehicleIds();
    if (!ids.includes(vehicleId)) {
      ids.unshift(vehicleId);
      localStorage.setItem(MY_VEHICLE_IDS_KEY, JSON.stringify(ids));
    }
  }

  myVehicleIds(): string[] {
    try {
      const raw = localStorage.getItem(MY_VEHICLE_IDS_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }
}
