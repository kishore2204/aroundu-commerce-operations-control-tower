/** S3 CatalogueSummaryResponse */
export interface CatalogueSummary {
  total: number;
  active: number;
  draft: number;
  outOfStock: number;
}

/** S3 InventorySummaryResponse */
export interface InventorySummary {
  totalProducts: number;
  totalStock: number;
  lowStock: number;
  outOfStock: number;
}

export type StockAdjustmentType = 'ADD_STOCK' | 'REMOVE_STOCK';

/** S3 StockAdjustmentRequest */
export interface StockAdjustmentRequest {
  productId: number;
  type: StockAdjustmentType;
  quantity: number;
}

/** S3 StockAdjustmentResponse */
export interface StockAdjustmentResult {
  productId: number;
  resultingQuantity: number;
  inventoryStatus: string;
}
