import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiResponse, PageResponse, unwrap } from '../api/api-response';
import { RatingSummary } from '../models/product.model';
import { Review, ReviewEligibility, ReviewRequest } from '../models/review.model';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  constructor(private readonly http: HttpClient) {}

  byProduct(productId: number, page = 0, size = 20): Observable<PageResponse<Review>> {
    const params = new HttpParams()
      .set('productId', productId)
      .set('page', page)
      .set('size', size);
    return this.http
      .get<ApiResponse<PageResponse<Review>>>('/api/v1/reviews', { params })
      .pipe(map(unwrap));
  }

  ratingSummary(productId: number): Observable<RatingSummary> {
    return this.http
      .get<ApiResponse<RatingSummary>>(`/api/v1/reviews/products/${productId}/rating-summary`)
      .pipe(map(unwrap));
  }

  create(request: ReviewRequest): Observable<Review> {
    return this.http.post<ApiResponse<Review>>('/api/v1/reviews', request).pipe(map(unwrap));
  }

  /** Whether the current customer has ever purchased/received this product - drives whether
   *  "Write a review" even shows, no manual Order ID required. */
  checkEligibility(productId: number): Observable<ReviewEligibility> {
    return this.http
      .get<ApiResponse<ReviewEligibility>>('/api/v1/reviews/eligibility', { params: { productId } })
      .pipe(map(unwrap));
  }
}
