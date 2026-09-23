import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiResponse, PageResponse, unwrap } from '../api/api-response';
import { Product, ProductDetails, ProductImage, ProductSearchParams } from '../models/product.model';
import { TtlCache } from '../api/ttl-cache';

@Injectable({ providedIn: 'root' })
export class ProductService {
  /** Image lists are requested once per product card - reused across cards, page changes and
   *  back-navigation instead of one request per card per visit. Image files themselves are
   *  already browser-cached by the backend's Cache-Control header. */
  private readonly imageLists = new TtlCache<number, ProductImage[]>(5 * 60_000, 1000);
  /** Home, the product list and the "more from this shop" strip ask for the same listings whenever a customer comes
   *  back to a page. Listings carry stock, so they are only remembered for a short time and are dropped at once when
   *  stock or the catalogue changes in this browser (a checkout, a retailer's product / stock edit): see `invalidateListings()`. */
  private readonly listings = new TtlCache<string, PageResponse<Product>>(30_000, 60);

  constructor(private readonly http: HttpClient) {}

  search(params: ProductSearchParams): Observable<PageResponse<Product>> {
    let httpParams = new HttpParams()
      .set('page', String(params.page ?? 0))
      .set('size', String(params.size ?? 20));
    if (params.q) httpParams = httpParams.set('q', params.q);
    if (params.categoryId != null) httpParams = httpParams.set('categoryId', String(params.categoryId));
    if (params.retailerId) httpParams = httpParams.set('retailerId', params.retailerId);
    if (params.inStock != null) httpParams = httpParams.set('inStock', String(params.inStock));
    if (params.zoneId) httpParams = httpParams.set('zoneId', params.zoneId);

    return this.listings.get(httpParams.toString(), () =>
      this.http.get<ApiResponse<PageResponse<Product>>>('/api/v1/products', { params: httpParams }).pipe(map(unwrap)),
    );
  }

  /** Forget the remembered listings - call after anything that changes stock, availability or the catalogue. */
  invalidateListings(): void {
    this.listings.clear();
  }

  get(id: number): Observable<Product> {
    return this.http.get<ApiResponse<Product>>(`/api/v1/products/${id}`).pipe(map(unwrap));
  }

  images(id: number): Observable<ProductImage[]> {
    return this.imageLists.get(id, () =>
      this.http.get<ApiResponse<ProductImage[]>>(`/api/v1/products/${id}/images`).pipe(map(unwrap)),
    );
  }

  getDetails(id: number): Observable<ProductDetails> {
    return this.http
      .get<ApiResponse<ProductDetails>>(`/api/v1/products/${id}/details`)
      .pipe(map(unwrap));
  }
}
