/** S6 AuditLog entity */
export interface AuditLog {
  auditLogId: string;
  userAccountId: string | null;
  action: string;
  sourceModule: string | null;
  oldValues: string | null;
  newValues: string | null;
  ipAddress: string | null;
  performedAt: string;
}

/** S6 AnalyticsOverviewResponse */
export interface AnalyticsOverview {
  paymentTransactions: number;
  invoices: number;
  refunds: number;
  settlements: number;
  supportTickets: number;
  notifications: number;
  auditLogs: number;
  recordedPaymentAmount: number;
  refundRate: number;
  settlementFeeRatio: number;
  averageTicketResolutionHours: number;
}


/** Aggregated refund-request insight for the admin dashboard. */
export interface RefundRegionInsight {
  region: string;
  requestCount: number;
  requestedAmount: number;
  approvedAmount: number;
  completedAmount: number;
}
