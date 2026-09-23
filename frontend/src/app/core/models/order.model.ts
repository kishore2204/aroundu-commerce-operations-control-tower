/**
 * S4 OrderDto. GET /api/orders/mine?customerProfileId=... (or ?retailerId=...) is the
 * customer's/retailer's own order list - see OrderService.mine(). orderStatus is one of the
 * retail fulfilment flow's stored values: NEW, WAITING_FOR_RETAILER, RETAILER_ACCEPTED,
 * RETAILER_REJECTED, FINDING_DELIVERY_PARTNER, SHOP_UNAVAILABLE, VEHICLE_ASSIGNED, IN_TRANSIT,
 * DELIVERED, CANCELLED, or (fleet-service bookings only) BOOKING_CONFIRMED - kept as a plain
 * string since the backend entity itself has no enum type, but the tracking screen should
 * always render via OrderTracking.steps/displayStage rather than switching on this raw value.
 */
export interface Order {
  id: number;
  orderNumber: string;
  customerProfileId: string;
  orderType: 'RETAIL' | 'FLEET_SERVICE' | string;
  orderDate: string;
  subtotalAmount: number;
  deliveryCharge: number;
  discountAmount: number;
  /** Previously computed for display at checkout but never persisted here, so an order's
   *  stored breakdown never actually summed to totalAmount when tax/platform fee applied. */
  taxAmount: number;
  platformFeeAmount: number;
  totalAmount: number;
  orderStatus: string;
  statusHistoryJson: string;
  orderTrackingJson: string;
  deliveryAddress: string | null;
  /** Internal (fleet screens only): sum of unit weight x quantity, in kg. Not sent on customer reads. */
  totalWeightKg?: number | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  paymentMethod: string;
  paymentStatus: string;
  transactionReference: string | null;
  cancellationReason: string | null;
  cancelledDatetime: string | null;
  cancellationFeeAmount: number | null;
  updatedDatetime: string;
}

export type CreateOrderRequest = Omit<Order, 'id' | 'cancellationFeeAmount' | 'updatedDatetime'>;

/** One step of the customer-facing fulfilment stepper - see OrderTracking.steps. */
export interface OrderTrackingStep {
  key: string;
  label: string;
  state: 'DONE' | 'CURRENT' | 'PENDING' | 'FAILED';
  reachedAt: string | null;
}

/**
 * S4 OrderTrackingDto - GET /api/orders/{id}/tracking. `steps`/`displayStage` are the
 * source of truth for the tracking UI - never assume a stage completed without reading them
 * fresh from the backend (poll, don't infer). `steps` is null and `haltedState` is set when
 * the order's fulfilment attempt has stopped short of delivery for this shop
 * (RETAILER_REJECTED/SHOP_UNAVAILABLE/CANCELLED) - render that as a distinct "halted" banner
 * with a "Find Another Shop" action, not as a stepper position.
 */
export interface OrderTracking {
  orderId: number;
  orderNumber: string;
  orderStatus: string;
  orderTrackingJson: string;
  updatedDatetime: string;
  slaStatus: 'PENDING' | 'IN_PROGRESS' | 'AT_RISK' | 'ON_TIME' | 'LATE' | string;
  displayStage: string;
  steps: OrderTrackingStep[] | null;
  haltedState: 'RETAILER_REJECTED' | 'SHOP_UNAVAILABLE' | 'CANCELLED' | null;
}

/** Who is delivering one shop's order - present only once a fleet owner has assigned a driver to it. */
export interface OrderDeliveryInfo {
  fleetOwnerBusinessName: string | null;
  driverName: string | null;
  vehicleNumber: string | null;
  phoneNumber: string | null;
}

/** One shop-specific order within a checkout - see OrderTrackingGroup. */
export interface ShopTracking {
  orderId: number;
  orderNumber: string;
  /** Human-readable shop name (null only if the shop lookup failed). */
  shopName: string | null;
  tracking: OrderTracking;
  delivery: OrderDeliveryInfo | null;
  /** Customer-friendly ETA such as "Within 35 minutes"; null when not applicable. */
  etaText: string | null;
}

/**
 * S4 OrderTrackingGroupDto - GET /api/orders/{id}/tracking-group. Every shop-specific order created by
 * the same checkout, in one payload (one poll for the whole group). A single-shop order is a
 * group of one.
 */
export interface OrderTrackingGroup {
  shops: ShopTracking[];
}

/** Optional reason a retailer gives when rejecting an order - POST /api/orders/{id}/retailer-reject */
export interface RetailerRejectRequest {
  reason?: string | null;
}

/** S4-local mirror of S2's RetailerSummary, as embedded on OrderItem.retailer. */
export interface OrderItemRetailerSummary {
  retailerId: string;
  userAccountId: string;
  businessName: string;
  cityId: string;
}

/** S4 OrderItemDto */
export interface OrderItem {
  id?: number;
  orderId: number;
  retailerId: string;
  productId: number;
  skuSnapshot?: string;
  productNameSnapshot?: string;
  quantity: number;
  unitPrice?: number;
  discountAmount?: number;
  lineTotal?: number;
  deliveryAddress?: string;
  /** Live-enriched, resolved fresh on every read - null if the retailer lookup failed. */
  retailer?: OrderItemRetailerSummary | null;
}

/** S6 PaymentTransactionRequest - field names verified against the S6 DTO source before use. */
export interface PaymentTransactionRequest {
  orderId: number;
  paymentMethod: string;
}

/**
 * S6 PaymentTransaction entity, returned directly (no envelope) by
 * POST /api/payment-transactions and POST /api/payment-transactions/{id}/capture. This is the
 * simulated payment step - paymentStatus PENDING -> SUCCESS on capture, no real payment
 * gateway involved.
 */
export interface PaymentTransaction {
  paymentTransactionId: string;
  orderId: number;
  paymentMethod: string;
  paymentStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | string;
  escrowStatus: 'NOT_HELD' | 'HELD' | 'RELEASED' | string;
  amount: number;
  currencyCode: string;
}
