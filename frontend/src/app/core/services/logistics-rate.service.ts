import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { LogisticsVehicleRate } from '../models/logistics-rate.model';

@Injectable({ providedIn: 'root' })
export class LogisticsRateService {
  constructor(private readonly http: HttpClient) {}
  list(): Observable<LogisticsVehicleRate[]> { return this.http.get<LogisticsVehicleRate[]>('/api/logistics-rates'); }
  update(rate: LogisticsVehicleRate): Observable<LogisticsVehicleRate> {
    return this.http.put<LogisticsVehicleRate>(`/api/logistics-rates/${rate.vehicleCategory}`, rate);
  }
}
