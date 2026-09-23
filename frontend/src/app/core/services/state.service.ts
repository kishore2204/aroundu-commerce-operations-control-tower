import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { TtlCache } from '../api/ttl-cache';
import { State, StateRequest } from '../models/state.model';

@Injectable({ providedIn: 'root' })
export class StateService {
  /** The state list is reference data read by the address, onboarding, territory and tax-rule screens; it is reused for
   *  two minutes and dropped at once whenever this session creates, changes or removes a state. */
  private readonly list = new TtlCache<'all', State[]>(2 * 60_000);

  constructor(private readonly http: HttpClient) {}

  all(): Observable<State[]> {
    return this.list.get('all', () => this.http.get<State[]>('/api/states'));
  }

  create(request: StateRequest): Observable<State> {
    return this.http.post<State>('/api/states', request).pipe(tap(() => this.list.clear()));
  }

  update(id: string, request: StateRequest): Observable<State> {
    return this.http.put<State>(`/api/states/${id}`, request).pipe(tap(() => this.list.clear()));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/states/${id}`).pipe(tap(() => this.list.clear()));
  }
}
