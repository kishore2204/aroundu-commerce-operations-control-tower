/**
 * S3 (Commerce & Customer) wraps every success response in this envelope.
 * Other services (S1, S4, S5, S6) return their DTOs directly - do not unwrap those.
 */
export interface ApiResponse<T> {
  timestamp: string;
  correlationId: string;
  message: string;
  data: T;
}

/** S3's hand-rolled page shape, found inside ApiResponse.data for list endpoints. */
export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** Spring Data's Page<T> shape, used by S1 (cities/zones/operations-managers/location-managers). */
export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export function unwrap<T>(response: ApiResponse<T>): T {
  return response.data;
}
