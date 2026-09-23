/** S6 Settlement entity */
export interface Settlement {
  settlementId: string;
  operationsManagerId: string | null;
  paymentTransactionId: string;
  /** "RETAILER" / "FLEET_OWNER" / "PLATFORM" / null for a legacy operations-manager settlement. */
  payeeType: string | null;
  /** The retailer/fleet-owner id this settlement pays out to - null for PLATFORM and legacy rows. */
  payeeId: string | null;
  /** Business name of the payee (retailer / fleet owner), "AroundU Platform" or "N/A" - what screens display. */
  payeeName?: string | null;
  settlementReference: string | null;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  settlementStatus: string;
  settlementDate: string;
  createdAt: string;
  completedAt: string | null;
}

/** S6 SettlementRequest */
export interface SettlementRequest {
  operationsManagerId?: string | null;
  paymentTransactionId: string;
  settlementReference?: string | null;
  grossAmount: number;
  feeAmount: number;
  settlementDate: string;
}

/** S6 SettlementUpdateRequest */
export interface SettlementUpdateRequest {
  settlementReference?: string | null;
  settlementDate?: string | null;
}

/** S6 PaymentTransaction entity - only the fields the settlement picker needs */
export interface PaymentTransaction {
  paymentTransactionId: string;
  orderId: number;
  providerReference: string | null;
  paymentMethod: string;
  paymentStatus: string;
  escrowStatus: string | null;
  amount: number;
  currencyCode: string | null;
}
