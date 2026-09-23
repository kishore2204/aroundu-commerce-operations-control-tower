export type ExpenseType = 'FUEL' | 'MAINTENANCE' | 'TOLL' | 'INSURANCE' | 'SALARY' | 'OTHER';
export type ExpenseApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** S5 FleetExpenseDto */
export interface FleetExpense {
  fleetExpenseId: string;
  fleetOwnerId: string;
  vehicleId: string | null;
  driverId: string | null;
  createdByAccountId: string;
  approvedByAccountId: string | null;
  attachmentUploadedByAccountId: string | null;
  expenseType: ExpenseType;
  amount: number;
  expenseDate: string;
  approvalStatus: ExpenseApprovalStatus;
  hasProof: boolean;
  proofFileName: string | null;
}
