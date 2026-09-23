import { CartItem } from './cart.model';
import { LineServiceabilityResult } from './product.model';

/** S3 CheckoutRequest */
export interface CheckoutRequest {
  addressId: string;
  redeemPoints?: number | null;
}

/**
 * S3 CheckoutResponse. `serviceable` is true only when every line in
 * `serviceabilityLines` is serviceable - a multi-retailer cart can have some lines blocked
 * while others remain valid, so always render the per-line breakdown (see
 * ServiceabilityConflictDialogComponent) rather than only the aggregate flag.
 */
export interface CheckoutRetailerBreakdown {
  retailerId: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  deliveryCharge: number;
  platformFee: number;
  discount: number;
  grandTotal: number;
}

export interface CheckoutSummary {
  addressId: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  deliveryCharge: number;
  platformFee: number;
  grandTotal: number;
  serviceable: boolean;
  pointsRedeemed: number;
  pointsEarned: number;
  rewardPointsBalance: number;
  serviceabilityLines: LineServiceabilityResult[];
  retailerBreakdowns: CheckoutRetailerBreakdown[];
}
