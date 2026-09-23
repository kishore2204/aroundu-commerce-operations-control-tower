import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { SpringPage } from '../api/api-response';
import { TtlCache } from '../api/ttl-cache';
import { City, CityRequest, Zone, ZoneRequest } from '../models/territory.model';

/**
 * GET is open to LOCATION_MANAGER too (see docs on the S1 SecurityConfig fix); the write
 * methods below only ever succeed for OPERATIONS_MANAGER/SUPER_ADMIN - a LOCATION_MANAGER
 * token gets 403 on them by design, so only OM-facing screens call these.
 */
@Injectable({ providedIn: 'root' })
export class TerritoryService {
  /** City/zone lists are reference data read by many forms and shells (address, onboarding,
   *  fleet header, ...). Reused for two minutes, and dropped at once whenever this session
   *  creates or (de)activates a city/zone, so an admin always sees their own change. */
  private readonly lists = new TtlCache<string, SpringPage<City> | SpringPage<Zone>>(2 * 60_000);

  constructor(private readonly http: HttpClient) {}

  cities(active?: boolean): Observable<SpringPage<City>> {
    let params = new HttpParams().set('size', 100);
    if (active != null) params = params.set('active', active);
    return this.lists.get(`cities|${active}`, () =>
      this.http.get<SpringPage<City>>('/api/v1/cities', { params }),
    ) as Observable<SpringPage<City>>;
  }

  zones(cityId?: string, active?: boolean): Observable<SpringPage<Zone>> {
    let params = new HttpParams().set('size', 100);
    if (cityId) params = params.set('cityId', cityId);
    if (active != null) params = params.set('active', active);
    return this.lists.get(`zones|${cityId ?? ''}|${active}`, () =>
      this.http.get<SpringPage<Zone>>('/api/v1/zones', { params }),
    ) as Observable<SpringPage<Zone>>;
  }

  /** Single-record reads - used to show a city/zone NAME where a record only carries the id. */
  city(id: string): Observable<City> {
    return this.http.get<City>(`/api/v1/cities/${id}`);
  }

  zone(id: string): Observable<Zone> {
    return this.http.get<Zone>(`/api/v1/zones/${id}`);
  }

  createCity(request: CityRequest): Observable<City> {
    return this.http.post<City>('/api/v1/cities', request).pipe(tap(() => this.lists.clear()));
  }

  setCityActive(id: string, active: boolean): Observable<City> {
    return this.http
      .patch<City>(`/api/v1/cities/${id}/${active ? 'activate' : 'deactivate'}`, {})
      .pipe(tap(() => this.lists.clear()));
  }

  createZone(request: ZoneRequest): Observable<Zone> {
    return this.http.post<Zone>('/api/v1/zones', request).pipe(tap(() => this.lists.clear()));
  }

  setZoneActive(id: string, active: boolean): Observable<Zone> {
    return this.http
      .patch<Zone>(`/api/v1/zones/${id}/${active ? 'activate' : 'deactivate'}`, {})
      .pipe(tap(() => this.lists.clear()));
  }
}
