/** S6 TaxConfiguration entity */
export interface TaxConfiguration {
  taxConfigurationId: string;
  /** The S3 product category the rate applies to - null only for a legacy rule not linked to a category yet. */
  productCategoryId: number | null;
  /** Display name kept with the rule (the category name, or the old typed name of a legacy rule). */
  taxCategoryName: string;
  description: string | null;
  stateId: string | null;
  cgst: number;
  sgst: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  active: boolean;
}

/** S6 TaxConfigurationCategoryRequest - the "New tax rule" form: the category is TYPED (reused if it exists, created if not). */
export interface TaxConfigurationByCategoryRequest {
  categoryName: string;
  description?: string | null;
  stateId?: string | null;
  cgst: number;
  sgst: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  active: boolean;
}

/** S6 TaxConfigurationSaveResponse - what the save did and the message to show. */
export interface TaxConfigurationSaveResult {
  taxConfiguration: TaxConfiguration;
  outcome: 'CATEGORY_AND_TAX_CONFIGURATION_CREATED' | 'TAX_CONFIGURATION_CREATED' | 'TAX_CONFIGURATION_UPDATED';
  message: string;
}

/** S6 TaxConfigurationRequest */
export interface TaxConfigurationRequest {
  productCategoryId: number;
  description?: string | null;
  stateId?: string | null;
  cgst: number;
  sgst: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  active: boolean;
}
