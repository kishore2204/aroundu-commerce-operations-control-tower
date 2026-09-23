import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { ProductService } from './product.service';
import { ApiResponse, PageResponse, unwrap } from '../api/api-response';
import { BulkDecision, BulkRejectedRow, BulkUploadResult } from '../models/bulk-upload.model';
import { CatalogueSummary } from '../models/inventory.model';
import { Product, ProductImage, ProductRequest } from '../models/product.model';

export interface CatalogueSearchParams {
  q?: string;
  categoryId?: number;
  status?: string;
  inventoryStatus?: string;
  page?: number;
  size?: number;
}

@Injectable({ providedIn: 'root' })
export class CatalogueService {
  constructor(
    private readonly http: HttpClient,
    private readonly products: ProductService,
  ) {}

  search(params: CatalogueSearchParams): Observable<PageResponse<Product>> {
    let httpParams = new HttpParams()
      .set('page', String(params.page ?? 0))
      .set('size', String(params.size ?? 20));
    if (params.q) httpParams = httpParams.set('q', params.q);
    if (params.categoryId != null) httpParams = httpParams.set('categoryId', String(params.categoryId));
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.inventoryStatus) httpParams = httpParams.set('inventoryStatus', params.inventoryStatus);

    return this.http
      .get<ApiResponse<PageResponse<Product>>>('/api/v1/retailers/me/products', { params: httpParams })
      .pipe(map(unwrap));
  }

  summary(): Observable<CatalogueSummary> {
    return this.http
      .get<ApiResponse<CatalogueSummary>>('/api/v1/retailers/me/products/summary')
      .pipe(map(unwrap));
  }

  create(request: ProductRequest): Observable<Product> {
    return this.http
      .post<ApiResponse<Product>>('/api/v1/retailers/me/products', request)
      .pipe(map(unwrap), tap(() => this.products.invalidateListings()));
  }

  update(id: number, request: ProductRequest): Observable<Product> {
    return this.http
      .patch<ApiResponse<Product>>(`/api/v1/retailers/me/products/${id}`, request)
      .pipe(map(unwrap), tap(() => this.products.invalidateListings()));
  }

  duplicate(id: number): Observable<Product> {
    return this.http
      .post<ApiResponse<Product>>(`/api/v1/retailers/me/products/${id}/duplicate`, {})
      .pipe(map(unwrap), tap(() => this.products.invalidateListings()));
  }

  images(id: number): Observable<ProductImage[]> {
    return this.http
      .get<ApiResponse<ProductImage[]>>(`/api/v1/retailers/me/products/${id}/images`)
      .pipe(map(unwrap));
  }

  uploadImages(id: number, files: File[]): Observable<ProductImage[]> {
    const formData = new FormData();
    for (const file of files) formData.append('files', file);
    return this.http
      .post<ApiResponse<ProductImage[]>>(`/api/v1/retailers/me/products/${id}/images`, formData)
      .pipe(map(unwrap));
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`/api/v1/retailers/me/products/${id}`).pipe(tap(() => this.products.invalidateListings()));
  }

  /**
   * Bulk create/update from a .xlsx/.csv file. Without `decisions`, a file that touches existing
   * products with different data answers NEEDS_DECISIONS and changes nothing; send the same file again
   * with the retailer's per-SKU choices to apply it.
   */
  bulkUpload(file: File, decisions?: Record<string, BulkDecision>): Observable<BulkUploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    if (decisions) formData.append('decisions', JSON.stringify(decisions));
    return this.http
      .post<ApiResponse<BulkUploadResult>>('/api/v1/retailers/me/products/bulk-upload', formData)
      .pipe(map(unwrap), tap(() => this.products.invalidateListings()));
  }

  /**
   * A template built by the server from the CURRENT active categories and product statuses each time it is asked for.
   * Both formats carry the field guidance in their header row (no separate guide file): `xlsx` additionally gets real
   * Category / Status dropdowns across the whole entry range; `csv` spells out the Category/Status guidance in words
   * since a CSV cannot hold a dropdown.
   */
  bulkTemplate(format: 'xlsx' | 'csv'): Observable<Blob> {
    return this.http.get('/api/v1/retailers/me/products/bulk-upload/template', {
      params: new HttpParams().set('format', format),
      responseType: 'blob',
    });
  }

  /** The rejected rows (original values + Error) as an XLSX or a CSV, built by the server from the rows the upload returned. */
  bulkRejectedReport(rows: BulkRejectedRow[], format: 'xlsx' | 'csv' = 'xlsx'): Observable<Blob> {
    return this.http.post('/api/v1/retailers/me/products/bulk-upload/rejected-report', { rows }, {
      params: new HttpParams().set('format', format),
      responseType: 'blob',
    });
  }
}
