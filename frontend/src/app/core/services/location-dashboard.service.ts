import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DashboardSummary,
  FleetAssets,
  RetailerReviewPage,
  ZoneUserPage,
  ZoneUserQuery,
} from '../models/location-dashboard.model';

/** The Location Manager's zone dashboard (S2). The zone is never sent - the server uses the caller's own assignment. */
@Injectable({ providedIn: 'root' })
export class LocationDashboardService {
  constructor(private readonly http: HttpClient) {}

  summary(from: string, to: string): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>('/api/location-dashboard/summary', { params: new HttpParams().set('from', from).set('to', to) });
  }

  users(query: ZoneUserQuery): Observable<ZoneUserPage> {
    let params = new HttpParams().set('type', query.type).set('page', query.page).set('size', query.size);
    for (const key of ['search', 'onboardingStatus', 'verificationStatus', 'activation', 'pendingAction', 'sort', 'direction'] as const) {
      const value = query[key];
      if (value) params = params.set(key, value);
    }
    return this.http.get<ZoneUserPage>('/api/location-dashboard/users', { params });
  }

  retailerReviews(retailerId: string, page = 0, size = 5): Observable<RetailerReviewPage> {
    return this.http.get<RetailerReviewPage>(`/api/location-dashboard/retailers/${retailerId}/reviews`, {
      params: new HttpParams().set('page', page).set('size', size),
    });
  }

  fleetAssets(fleetOwnerId: string): Observable<FleetAssets> {
    return this.http.get<FleetAssets>(`/api/location-dashboard/fleet-owners/${fleetOwnerId}/assets`);
  }
}
