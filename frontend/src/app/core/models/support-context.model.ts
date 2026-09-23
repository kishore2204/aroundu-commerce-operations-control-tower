/**
 * S6 TicketContext (GET /api/support-tickets/{id}/context) - a consolidated, read-only snapshot
 * of a ticket's linked order, so an agent (or the retailer/fleet owner it's escalated to) never
 * has to leave the ticket to look this up. Each field is independently nullable/empty: a ticket
 * may have no orderId, no trip yet, or no customerProfileId. These mirror S6's internal
 * OrderResponse/OrderItemResponse/TripResponse/CustomerProfileResponse Feign DTOs exactly -
 * distinct shapes from this app's own Order/OrderItem/Trip models (different field names,
 * S6 only exposes a subset), so kept as their own types rather than reusing those.
 */
export interface TicketContextOrder {
  orderId: number;
  orderNumber: string;
  customerProfileId: string;
  orderType: string;
  orderDate: string;
  subtotalAmount: number;
  deliveryCharge: number;
  discountAmount: number;
  totalAmount: number;
  orderStatus: string;
  paymentMethod: string;
  paymentStatus: string;
  transactionReference: string | null;
  deliveredAt: string | null;
}

export interface TicketContextOrderItem {
  orderItemId: number;
  orderId: number;
  retailerId: string;
  productId: number;
  skuSnapshot: string;
  productNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
}

export interface TicketContextTrip {
  tripId: string;
  orderId: number;
  vehicleId: string;
  driverId: string;
  fleetOwnerId: string;
  tripStatus: string;
  completedAt: string | null;
  proofOfDelivery: string | null;
}

export interface TicketContextCustomer {
  customerProfileId: string;
  userAccountId: string;
  profileStatus: string;
  rewardPointsBalance: number;
}

export interface TicketContext {
  order: TicketContextOrder | null;
  items: TicketContextOrderItem[];
  trip: TicketContextTrip | null;
  customer: TicketContextCustomer | null;
  retailerBusinessName: string | null;
  fleetOwnerBusinessName: string | null;
}
