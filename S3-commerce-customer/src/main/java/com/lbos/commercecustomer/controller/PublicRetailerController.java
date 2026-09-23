package com.lbos.commercecustomer.controller; import com.lbos.commercecustomer.dto.client.partner.RetailerSummaryResponse;import com.lbos.commercecustomer.dto.response.*;import com.lbos.commercecustomer.exception.ResourceNotFoundException;import com.lbos.commercecustomer.service.ReviewService;import com.lbos.commercecustomer.service.impl.RetailerEnrichmentSupport;import jakarta.servlet.http.HttpServletRequest;import java.util.*;import org.springframework.web.bind.annotation.*;
/**
 * Customer-facing shop-detail reads (shop name/status/location, rating summary). Kept separate
 * from CatalogueController/InventoryController, which are both retailer-self-service under
 * /api/v1/retailers/me/** - these are public, read-only sub-paths any authenticated customer
 * (or retailer) can call, matched ahead of the general /api/v1/retailers/** Gateway rule (see
 * RouteAuthorizationRules). Distinct from S2's own /api/retailers/{id} (RETAILER/staff-only,
 * the onboarding-facing surface) - this is the customer-catalogue-facing mirror, resolved the
 * same way ProductDiscoveryServiceImpl enriches product listings.
 */
@RestController @RequestMapping("/api/v1/retailers")
public class PublicRetailerController {
    private final ReviewService reviews;
    private final RetailerEnrichmentSupport retailers;
    public PublicRetailerController(ReviewService reviews,RetailerEnrichmentSupport retailers){this.reviews=reviews;this.retailers=retailers;}
    private <T> ApiResponse<T> ok(HttpServletRequest r,String m,T d){return ApiResponse.of(Optional.ofNullable(r.getHeader("X-Correlation-Id")).orElse("not-provided"),m,d);}

    @GetMapping("/{retailerId}")
    public ApiResponse<RetailerSummaryResponse> get(@PathVariable UUID retailerId,HttpServletRequest h){
        RetailerSummaryResponse retailer=retailers.resolveOne(retailerId);
        if(retailer==null)throw new ResourceNotFoundException("Retailer not found: "+retailerId);
        return ok(h,"Retailer details retrieved",retailer);
    }

    @GetMapping("/{retailerId}/rating-summary")
    public ApiResponse<RetailerRatingSummaryResponse> ratingSummary(@PathVariable UUID retailerId,HttpServletRequest h){
        return ok(h,"Retailer rating summary retrieved",reviews.retailerRating(retailerId));
    }
}
