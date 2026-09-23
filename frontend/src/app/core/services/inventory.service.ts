import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { ProductService } from './product.service';
import { ApiResponse, PageResponse, unwrap } from '../api/api-response';
import { InventorySummary, StockAdjustmentRequest, StockAdjustmentResult } from '../models/inventory.model';
import { Product } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  constructor(
    private readonly http: HttpClient,
    private readonly products: ProductService,
  ) {}

  search(q: string | undefined, categoryId: number | undefined, inventoryStatus: string | undefined, page = 0, size = 20): Observable<PageResponse<Product>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (q) params = params.set('q', q);
    if (categoryId != null) params = params.set('categoryId', String(categoryId));
    if (inventoryStatus) params = params.set('inventoryStatus', inventoryStatus);

    return this.http
      .get<ApiResponse<PageResponse<Product>>>('/api/v1/retailers/me/inventory', { params })
      .pipe(map(unwrap));
  }

  summary(): Observable<InventorySummary> {
    return this.http
      .get<ApiResponse<InventorySummary>>('/api/v1/retailers/me/inventory/summary')
      .pipe(map(unwrap));
  }

  adjust(request: StockAdjustmentRequest): Observable<StockAdjustmentResult> {
    return this.http
      .post<ApiResponse<StockAdjustmentResult>>('/api/v1/retailers/me/inventory/adjustments', request)
      .pipe(map(unwrap), tap(() => this.products.invalidateListings()));
  }
}
