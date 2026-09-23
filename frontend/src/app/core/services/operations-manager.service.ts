import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SpringPage } from '../api/api-response';
import {
  OperationsManagerAssignment,
  OperationsManagerCreateRequest,
  OperationsManagerSummary,
} from '../models/operations-manager.model';

/** Server-side filters of the Admin Operations Manager list - every one is optional and they combine. */
export interface OperationsManagerQuery {
  /** Free text over name, email, phone and city. */
  q?: string;
  /** AssignmentStatus: ACTIVE, INACTIVE, SUSPENDED or TRANSFERRED. */
  status?: string;
  cityId?: string;
  page?: number;
  size?: number;
  /** "property,direction", e.g. "userAccount.firstName,asc". */
  sort?: string;
}

@Injectable({ providedIn: 'root' })
export class OperationsManagerService {
  constructor(private readonly http: HttpClient) {}

  /** The Operations Manager assignment for a given userAccountId - used for self-lookup
   *  (GET /api/v1/operations-managers/by-user/{id}). */
  byUser(userAccountId: string): Observable<OperationsManagerAssignment> {
    return this.http.get<OperationsManagerAssignment>(`/api/v1/operations-managers/by-user/${userAccountId}`);
  }

  list(cityId?: string): Observable<SpringPage<OperationsManagerAssignment>> {
    let params = new HttpParams().set('size', 100);
    if (cityId) params = params.set('cityId', cityId);
    return this.http.get<SpringPage<OperationsManagerAssignment>>('/api/v1/operations-managers', { params });
  }

  /** One page of Operations Managers, filtered, searched and sorted by the server. */
  search(query: OperationsManagerQuery): Observable<SpringPage<OperationsManagerAssignment>> {
    let params = new HttpParams().set('page', query.page ?? 0).set('size', query.size ?? 10);
    const term = query.q?.trim();
    if (term) params = params.set('q', term);
    if (query.status) params = params.set('status', query.status);
    if (query.cityId) params = params.set('cityId', query.cityId);
    if (query.sort) params = params.set('sort', query.sort);
    return this.http.get<SpringPage<OperationsManagerAssignment>>('/api/v1/operations-managers', { params });
  }

  create(request: OperationsManagerCreateRequest): Observable<OperationsManagerAssignment> {
    return this.http.post<OperationsManagerAssignment>('/api/v1/operations-managers', request);
  }

  setStatus(id: string, status: string): Observable<OperationsManagerAssignment> {
    return this.http.patch<OperationsManagerAssignment>(`/api/v1/operations-managers/${id}/status`, { status });
  }

  reassignCity(id: string, cityId: string): Observable<OperationsManagerAssignment> {
    return this.http.patch<OperationsManagerAssignment>(`/api/v1/operations-managers/${id}/city`, { cityId });
  }

  summary(): Observable<OperationsManagerSummary> {
    return this.http.get<OperationsManagerSummary>('/api/v1/operations-managers/summary');
  }
}
