import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiResponse, unwrap } from '../api/api-response';
import { ProductCategory } from '../models/category.model';
import { TtlCache } from '../api/ttl-cache';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  /** Home and the product list both load the category chips on every visit; the list changes
   *  rarely and is the same for every user, so it is reused for a few minutes. */
  private readonly activeCategories = new TtlCache<'active', ProductCategory[]>(5 * 60_000);

  constructor(private readonly http: HttpClient) {}

  /** Always asks the server (and refreshes the shared cache) - for screens where a stale category list would let
   *  a user miss or pick a category that has just changed, e.g. creating a product or a tax rule. */
  activeFresh(): Observable<ProductCategory[]> {
    this.activeCategories.clear();
    return this.active();
  }

  /** Forget the cached list - call after anything that creates or changes a category, so the next screen re-reads it. */
  invalidate(): void {
    this.activeCategories.clear();
  }

  active(): Observable<ProductCategory[]> {
    return this.activeCategories.get('active', () =>
      this.http.get<ApiResponse<ProductCategory[]>>('/api/v1/product-categories/active').pipe(map(unwrap)),
    );
  }
}
