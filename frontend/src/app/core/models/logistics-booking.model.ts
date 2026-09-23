/** S4 LogisticsBookingDetailDto - a point-to-point delivery booking (no retailer/products
 *  involved) attached to a FLEET_SERVICE order. Creating one flips that order straight to
 *  BOOKING_CONFIRMED (see LogisticsBookingDetailService.updateOrderAmounts), which is what
 *  makes it visible to fleet owners on GET /api/orders/pending-fleet-assignment. */
export interface LogisticsBookingDetail {
  orderId: number;
  vehicleReferenceId: string | null;
  receiverCustomerProfileId: string | null;
  receiverName: string;
  receiverPhoneNumber: string;
  receiverEmail: string | null;
  bookingType: string;
  bookingLocationsJson: string;
  specialInstructions: string | null;
  estimatedDistanceKm: number;
  specialHandlingRequired: boolean;
  priorityDelivery: boolean;
  lastMileDeliveryRequired: boolean;
  estimatedLogisticsCost: number;
}

/** What the price of a booking depends on - sent to S4's quote endpoint (the same calculation the booking is charged with). */
export interface LogisticsQuoteRequest {
  bookingType: string;
  estimatedDistanceKm: number;
  specialHandlingRequired: boolean;
  priorityDelivery: boolean;
  lastMileDeliveryRequired: boolean;
}

/** S4 LogisticsQuoteResponse - the logistics charge and the total the customer pays (what the order stores). */
export interface LogisticsQuote {
  logisticsCharge: number;
  totalAmount: number;
}

export type CreateLogisticsBookingRequest = Omit<LogisticsBookingDetail, 'estimatedLogisticsCost'>;

/** One entry of bookingLocationsJson - the backend requires exactly one PICKUP and one DROP
 *  (see LogisticsBookingDetailService.validateLocationsAndGetCount). */
export interface BookingLocation {
  type: 'PICKUP' | 'DROP';
  address: string;
}
