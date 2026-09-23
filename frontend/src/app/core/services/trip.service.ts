import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateTripRequest, Trip, TripStatusHistoryEntry, UpdateTripRequest } from '../models/trip.model';

@Injectable({ providedIn: 'root' })
export class TripService {
  constructor(private readonly http: HttpClient) {}

  /** A fleet owner accepting a delivery request IS creating a Trip - see CreateTripRequest. */
  create(request: CreateTripRequest): Observable<Trip> {
    return this.http.post<Trip>('/api/trips', request);
  }

  /** This fleet owner's own trips (GET /api/trips/mine?fleetOwnerId=). */
  mine(fleetOwnerId: string): Observable<Trip[]> {
    const params = new HttpParams().set('fleetOwnerId', fleetOwnerId);
    return this.http.get<Trip[]>('/api/trips/mine', { params });
  }

  /** This driver's assigned trips (GET /api/trips/driver/mine). */
  driverMine(): Observable<Trip[]> {
    return this.http.get<Trip[]>('/api/trips/driver/mine');
  }

  /** Full-object update (PUT) - TripService.update() on S4 drives every status transition
   *  except the two convenience lifecycle actions below. */
  update(id: string, request: UpdateTripRequest): Observable<Trip> {
    return this.http.put<Trip>(`/api/trips/${id}`, request);
  }

  /** ASSIGNED -> IN_PROGRESS, stamps actualStartAt. */
  confirmPickup(id: string, proof: string): Observable<Trip> {
    return this.http.post<Trip>(`/api/trips/${id}/pickup/confirm`, { proof });
  }

  /** IN_PROGRESS -> COMPLETED, stamps completedAt - requires distanceKm already set via update(). */
  complete(id: string, proof: string): Observable<Trip> {
    return this.http.post<Trip>(`/api/trips/${id}/complete`, { proof });
  }

  /** Timestamped audit trail of every status transition this trip has gone through. */
  history(id: string): Observable<TripStatusHistoryEntry[]> {
    return this.http.get<TripStatusHistoryEntry[]>(`/api/trips/${id}/history`);
  }
}
