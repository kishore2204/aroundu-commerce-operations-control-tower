import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { VehicleAssignment } from '../models/vehicle-assignment.model';

@Injectable({ providedIn: 'root' })
export class AssignmentService {
  constructor(private readonly http: HttpClient) {}

  /** This fleet owner's own vehicle assignments (GET /api/assignments/mine?fleetOwnerId=). */
  mine(fleetOwnerId: string): Observable<VehicleAssignment[]> {
    const params = new HttpParams().set('fleetOwnerId', fleetOwnerId);
    return this.http.get<VehicleAssignment[]>('/api/assignments/mine', { params });
  }
}
