/** S1 CityDtos.Response */
export interface City {
  id: string;
  cityName: string;
  stateId: string;
  stateName: string;
  active: boolean;
}

/** S1 ZoneDto */
export interface Zone {
  zoneId: string;
  cityId: string;
  cityName: string;
  stateId: string;
  stateName: string;
  zoneName: string;
  active: boolean;
}

/** S1 CityDtos.CreateRequest / UpdateRequest */
export interface CityRequest {
  stateId: string;
  cityName: string;
  active?: boolean;
}

/** S1 ZoneDto used as a request (zoneId/cityName/stateId/stateName ignored on write) */
export interface ZoneRequest {
  cityId: string;
  zoneName: string;
}
