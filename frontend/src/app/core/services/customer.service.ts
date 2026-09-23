import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiResponse, unwrap } from '../api/api-response';
import { CustomerProfile, UpdateCustomerRequest } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  constructor(private readonly http: HttpClient) {}

  me(): Observable<CustomerProfile> {
    return this.http.get<ApiResponse<CustomerProfile>>('/api/v1/customers/me').pipe(map(unwrap));
  }

  update(request: UpdateCustomerRequest): Observable<CustomerProfile> {
    return this.http
      .patch<ApiResponse<CustomerProfile>>('/api/v1/customers/me', request)
      .pipe(map(unwrap));
  }
}
