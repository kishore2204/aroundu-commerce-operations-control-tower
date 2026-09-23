import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiResponse, PageResponse, unwrap } from '../api/api-response';
import { WishlistItem, WishlistProductRequest, WishlistSummary } from '../models/wishlist.model';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  constructor(private readonly http: HttpClient) {}

  list(page = 0, size = 20): Observable<PageResponse<WishlistItem>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http
      .get<ApiResponse<PageResponse<WishlistItem>>>('/api/v1/customers/me/wishlist-items', { params })
      .pipe(map(unwrap));
  }

  summary(): Observable<WishlistSummary> {
    return this.http
      .get<ApiResponse<WishlistSummary>>('/api/v1/customers/me/wishlist-items/summary')
      .pipe(map(unwrap));
  }

  add(request: WishlistProductRequest): Observable<WishlistItem> {
    return this.http
      .post<ApiResponse<WishlistItem>>('/api/v1/customers/me/wishlist-items', request)
      .pipe(map(unwrap));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/customers/me/wishlist-items/${id}`);
  }
}
