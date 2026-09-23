/** S1 StateDto */
export interface State {
  id: string;
  stateName: string;
  countryCode: string;
  isActive: boolean;
}

export interface StateRequest {
  stateName: string;
  countryCode: string;
  isActive: boolean;
}
