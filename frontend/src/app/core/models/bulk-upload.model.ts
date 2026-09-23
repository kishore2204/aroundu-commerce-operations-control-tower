/**
 * S3 BulkProductUploadResponse - POST /api/v1/retailers/me/products/bulk-upload.
 * Products are identified by SKU and name, categories by name; no ids are exposed.
 */

/** What to do with an uploaded SKU that already exists with different data. */
export type BulkDecision = 'UPDATE' | 'KEEP' | 'SKIP';

export interface BulkFieldChange {
  field: string;
  existing: string | null;
  uploaded: string | null;
}

export interface BulkConflict {
  sku: string;
  existingName: string;
  changes: BulkFieldChange[];
}

/** A row that was not applied: original cell values by column name, why, and which cells to blame. */
export interface BulkRejectedRow {
  rowNumber: number;
  values: Record<string, string>;
  error: string;
  errorFields: string[];
}

export interface BulkUploadResult {
  /** NEEDS_DECISIONS: nothing has been written yet - see `conflicts`. COMPLETED: see the counts. */
  status: 'NEEDS_DECISIONS' | 'COMPLETED';
  totalRows: number;
  conflicts: BulkConflict[];
  created: number;
  updated: number;
  unchanged: number;
  rejected: number;
  rejectedRows: BulkRejectedRow[];
}
