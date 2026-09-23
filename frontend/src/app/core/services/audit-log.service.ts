import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AnalyticsOverview, AuditLog, RefundRegionInsight } from '../models/audit-log.model';

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  constructor(private readonly http: HttpClient) {}

  list(): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>('/api/audit-logs');
  }
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  constructor(private readonly http: HttpClient) {}

  overview(): Observable<AnalyticsOverview> {
    return this.http.get<AnalyticsOverview>('/api/analytics/overview');
  }

  refundRegions(): Observable<RefundRegionInsight[]> {
    return this.http.get<RefundRegionInsight[]>('/api/analytics/refunds/by-region');
  }
}
