/** S6 CustomerRefund entity, returned directly (no envelope). */
export interface CustomerRefund {
  customerRefundId: string;
  customerTicketId: string | null;
  paymentTransactionId: string;
  orderItemId: number;
  refundReference: string | null;
  refundAmount: number;
  refundStatus: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  reason: string | null;
  requestedAt: string;
  processedAt: string | null;
}

/** One order item and its remaining backend-authoritative refundable balance. */
export interface RefundableOrderItem {
  orderItemId: number;
  productName: string | null;
  quantity: number;
  lineTotal: number;
  alreadyRequestedAmount: number;
  remainingRefundableAmount: number;
}

/** Result of S6's support-ticket refund eligibility evaluation. */
export interface RefundEligibility {
  eligible: boolean;
  reason: string;
  paymentTransactionId: string | null;
  items: RefundableOrderItem[];
}

/** S6 CustomerRefundRequest. */
export interface CustomerRefundRequest {
  customerTicketId?: string | null;
  paymentTransactionId: string;
  orderItemId: number;
  refundReference?: string | null;
  refundAmount: number;
  reason: string;
}
