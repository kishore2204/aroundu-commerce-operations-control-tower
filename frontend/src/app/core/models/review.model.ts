/** S3 ReviewResponse */
export interface Review {
  id: string;
  orderId: number;
  productId: number;
  rating: number;
  reviewText: string | null;
  createdAt: string;
}

/** S3 ReviewRequest */
export interface ReviewRequest {
  orderId: number;
  productId: number;
  rating: number;
  reviewText?: string | null;
}

/** S3 UpdateReviewRequest */
export interface UpdateReviewRequest {
  rating: number;
  reviewText?: string | null;
}

/** S3's mirror of S4's ReviewEligibilityResponse - GET /api/v1/reviews/eligibility. orderId is
 *  the most recent DELIVERED order containing this product for the current customer, or null
 *  when not eligible. */
export interface ReviewEligibility {
  eligible: boolean;
  orderId: number | null;
  customerProfileId: string;
  productId: number;
  reasonCode: string | null;
}
