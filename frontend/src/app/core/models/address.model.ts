/** S3 AddressResponse */
export interface Address {
  id: string;
  cityId: string;
  cityName: string;
  zoneId: string | null;
  zoneName: string | null;
  addressTag: string;
  line1: string;
  line2: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  defaultAddress: boolean;
}

/**
 * S3 AddressRequest - note the backend resolves cityName/zoneName to S1 territory
 * ids server-side (POST /internal/v1/territories/validate); it does not take ids directly.
 */
export interface AddressRequest {
  cityName: string;
  zoneName: string;
  addressTag: string;
  line1: string;
  line2?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  defaultAddress: boolean;
}
