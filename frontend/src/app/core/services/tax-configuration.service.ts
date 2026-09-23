import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  TaxConfiguration,
  TaxConfigurationByCategoryRequest,
  TaxConfigurationRequest,
  TaxConfigurationSaveResult,
} from '../models/tax-configuration.model';

@Injectable({ providedIn: 'root' })
export class TaxConfigurationService {
  constructor(private readonly http: HttpClient) {}

  list(): Observable<TaxConfiguration[]> {
    return this.http.get<TaxConfiguration[]>('/api/tax-configurations');
  }

  create(request: TaxConfigurationRequest): Observable<TaxConfiguration> {
    return this.http.post<TaxConfiguration>('/api/tax-configurations', request);
  }

  /** New tax rule with a typed category: the server reuses the category (trimmed, case-insensitive) or creates it ACTIVE,
   *  then creates the rule - or updates the rule that already exists for the same category, state and period. */
  saveByCategoryName(request: TaxConfigurationByCategoryRequest): Observable<TaxConfigurationSaveResult> {
    return this.http.post<TaxConfigurationSaveResult>('/api/tax-configurations/by-category-name', request);
  }

  update(id: string, request: TaxConfigurationRequest): Observable<TaxConfiguration> {
    return this.http.put<TaxConfiguration>(`/api/tax-configurations/${id}`, request);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/tax-configurations/${id}`);
  }
}
