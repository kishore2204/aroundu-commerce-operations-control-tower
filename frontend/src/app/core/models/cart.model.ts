import { LineServiceabilityResult } from './product.model';

/** S3 CartItemResponse */
export interface CartItem {
  cartItemId: string;
  productId: number;
  productName: string;
  retailerId: string;
  retailerName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  availableStock: number;
  productActive: boolean;
}

/** S3 CartResponse */
export interface Cart {
  items: CartItem[];
  distinctProducts: number;
  totalQuantity: number;
  subtotal: number;
}

/** S3 CartItemRequest */
export interface CartItemRequest {
  productId: number;
  quantity: number;
}

/** S3 CartValidationIssue */
export interface CartValidationIssue {
  productId: number;
  issueCode: string;
  message: string;
}

/** S3 CartValidationResponse */
export interface CartValidationResult {
  cart: Cart;
  valid: boolean;
  issues: CartValidationIssue[];
}

/** S3 CartServiceabilityRequest - POST /api/v1/cart/serviceability-check */
export interface CartServiceabilityRequest {
  addressId: string;
}

/**
 * S3 CartServiceabilityResponse. Checked every time the customer picks a different delivery
 * address in the Cart (before it's persisted as default), and again by CheckoutService.prepare()
 * right before payment - see the requirement that serviceability must be re-checked at both
 * points. `lines` holds one verdict per cart item/retailer so a multi-retailer cart can show
 * which specific shop(s) are unserviceable rather than failing the whole cart at once.
 */
export interface CartServiceabilityResult {
  addressId: string;
  allServiceable: boolean;
  lines: LineServiceabilityResult[];
}
