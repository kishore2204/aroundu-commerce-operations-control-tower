export type ProductStatus = 'ACTIVE' | 'DRAFT' | string;
export type InventoryStatus = 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK' | string;

export interface ProductImage {
  fileName: string;
  url: string;
  primary: boolean;
}

/** S3 ProductRequest - used by CatalogueController create()/update() */
export interface ProductRequest {
  name: string;
  sku: string;
  categoryId: number;
  unitPrice: number;
  stock?: number | null;
  status: ProductStatus;
  description: string;
  lowStockThreshold?: number | null;
  /** Weight of one unit in kg (> 0). Blank/omitted means 1 kg. */
  weightKg?: number | null;
}

/**
 * S3 ProductResponse. retailerName/retailerStatus/retailerLatitude/retailerLongitude
 * identify the shop this product is sold by - resolved server-side from S2, best-effort
 * (null if that lookup failed). Every product card must show retailerName; use
 * ShopDetailExpanderComponent for the full shop-detail expand (rating fetched separately,
 * see RetailerService.ratingSummary()).
 */
export interface Product {
  id: number;
  name: string;
  sku: string;
  categoryId: number;
  categoryName: string;
  retailerId: string;
  retailerName: string | null;
  retailerStatus: string | null;
  retailerLatitude: number | null;
  retailerLongitude: number | null;
  unitPrice: number;
  stock: number;
  status: ProductStatus;
  inventoryStatus: InventoryStatus;
  description: string;
  qualityFlag: string | null;
  lowStockThreshold: number | null;
  /** Weight of one unit in kg; products without a stored weight report 1. */
  weightKg?: number | null;
}

/** S4 LineServiceabilityResult - one verdict per product/retailer in a serviceability check. */
export interface LineServiceabilityResult {
  productId: number;
  retailerId: string;
  serviceable: boolean;
  reasonCode: string | null;
  deliveryCharge: number | null;
  estimate: string | null;
}

/** S3 RatingSummaryResponse */
export interface RatingSummary {
  productId: number;
  average: number;
  count: number;
  distribution: Record<number, number>;
}

/** S3 ProductDetailsResponse - GET /api/v1/products/{id}/details */
export interface ProductDetails {
  product: Product;
  ratingSummary: RatingSummary;
}

export interface ProductSearchParams {
  q?: string;
  categoryId?: number;
  retailerId?: string;
  inStock?: boolean;
  /** Only products from retailers serviceable in this zone - see CustomerZoneService. */
  zoneId?: string;
  page?: number;
  size?: number;
}
