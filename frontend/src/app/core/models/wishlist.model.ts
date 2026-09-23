import { Product } from './product.model';

/** S3 WishlistResponse */
export interface WishlistItem {
  id: string;
  product: Product;
  createdAt: string;
}

/** S3 WishlistSummaryResponse */
export interface WishlistSummary {
  total: number;
  available: number;
  outOfStock: number;
}

/** S3 ReplaceWishlistProductRequest */
export interface WishlistProductRequest {
  productId: number;
}
