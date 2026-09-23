import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SpringPage } from '../api/api-response';
import { LocationManagerAssignment, LocationManagerAssignmentRequest } from '../models/location-manager-assignment.model';

@Injectable({ providedIn: 'root' })
export class LocationManagerAssignmentService {
  constructor(private readonly http: HttpClient) {}

  /** The authenticated Location Manager's own assignment (GET /api/v1/location-managers/me). */
  mine(): Observable<LocationManagerAssignment> {
    return this.http.get<LocationManagerAssignment>('/api/v1/location-managers/me');
  }

  list(zoneId?: string, operationsManagerId?: string): Observable<SpringPage<LocationManagerAssignment>> {
    let params = new HttpParams().set('size', 100);
    if (zoneId) params = params.set('zoneId', zoneId);
    if (operationsManagerId) params = params.set('operationsManagerId', operationsManagerId);
    return this.http.get<SpringPage<LocationManagerAssignment>>('/api/v1/location-managers', { params });
  }

  create(request: LocationManagerAssignmentRequest): Observable<LocationManagerAssignment> {
    return this.http.post<LocationManagerAssignment>('/api/v1/location-managers', request);
  }

  /** An Operations Manager creating a new officer under themselves in one step - account +
   *  zone assignment. The supervising Operations Manager is always resolved server-side from
   *  the caller's own JWT, never sent from here. */
  createOfficer(request: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    zoneId: string;
  }): Observable<LocationManagerAssignment> {
    return this.http.post<LocationManagerAssignment>('/api/v1/location-managers/officers', request);
  }

  /** Active Location Managers in the same state - the eligible targets for taking over an officer's work. */
  transferCandidates(id: string): Observable<LocationManagerAssignment[]> {
    return this.http.get<LocationManagerAssignment[]>(`/api/v1/location-managers/${id}/transfer-candidates`);
  }

  /** Moves an officer to another zone (the server refuses while they still hold pending verification work). */
  transfer(assignment: LocationManagerAssignment, zoneId: string): Observable<LocationManagerAssignment> {
    return this.http.put<LocationManagerAssignment>(`/api/v1/location-managers/${assignment.locationManagerId}/transfer`, {
      userAccountId: assignment.userAccountId,
      zoneId,
      operationsManagerId: assignment.operationsManagerId,
    });
  }

  setActive(id: string, active: boolean): Observable<LocationManagerAssignment> {
    return this.http.patch<LocationManagerAssignment>(`/api/v1/location-managers/${id}/${active ? 'activate' : 'deactivate'}`, {});
  }
}
