package com.lbos.commercecustomer.controller;

import com.lbos.commercecustomer.dto.response.ApiResponse;
import com.lbos.commercecustomer.dto.response.PageResponse;
import com.lbos.commercecustomer.dto.response.ProductDetailsResponse;
import com.lbos.commercecustomer.dto.response.ProductResponse;
import com.lbos.commercecustomer.service.ProductDiscoveryService;
import com.lbos.commercecustomer.service.ReviewService;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/products")
public class ProductController {

  private final ProductDiscoveryService productDiscoveryService;
  private final ReviewService reviewService;

  public ProductController(ProductDiscoveryService productDiscoveryService, ReviewService reviewService) {
    this.productDiscoveryService = productDiscoveryService;
    this.reviewService = reviewService;
  }

  private <T> ApiResponse<T> ok(HttpServletRequest request, String message, T data) {
    return ApiResponse.of(
        Optional.ofNullable(request.getHeader("X-Correlation-Id")).orElse("not-provided"), message, data);
  }

  @SecurityRequirements
  @GetMapping
  public ApiResponse<PageResponse<ProductResponse>> search(
      @RequestParam(name = "q", required = false) String query,
      @RequestParam(required = false) Long categoryId,
      @RequestParam(required = false) UUID retailerId,
      @RequestParam(required = false) Boolean inStock,
      @RequestParam(required = false) UUID zoneId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size,
      HttpServletRequest request) {
    return ok(
        request,
        "Products retrieved",
        productDiscoveryService.search(query, categoryId, retailerId, inStock, zoneId, page, size));
  }

  @SecurityRequirements
  @GetMapping("/{id}")
  public ApiResponse<ProductResponse> get(@PathVariable Long id, HttpServletRequest request) {
    return ok(request, "Product retrieved", productDiscoveryService.get(id));
  }

  /**
   * Batched form of {@link #get(Long, HttpServletRequest)} - every requested id in ONE query
   * instead of one call per id. Added for S4's checkout serviceability check (see
   * InternalOrderLogisticsController.serviceability in lbos-order), which previously called this
   * endpoint once per cart line. Capped at 100 ids - this backs a single cart's worth of lines,
   * not a bulk export.
   */
  @SecurityRequirements
  @GetMapping("/by-ids")
  public ApiResponse<java.util.List<ProductResponse>> getByIds(
      @RequestParam java.util.List<Long> ids, HttpServletRequest request) {
    if (ids.isEmpty() || ids.size() > 100) {
      throw new com.lbos.commercecustomer.exception.BusinessValidationException("ids must have between 1 and 100 entries");
    }
    return ok(request, "Products retrieved", productDiscoveryService.getByIds(ids));
  }

  /**
   * Single-call payload for the customer product-details screen. Reuses the existing
   * discovery and review services rather than duplicating their logic; the plain
   * {@code GET /api/v1/products/{id}} contract above is deliberately left untouched.
   */
  @SecurityRequirements
  @GetMapping("/{id}/details")
  public ApiResponse<ProductDetailsResponse> details(@PathVariable Long id, HttpServletRequest request) {
    ProductResponse product = productDiscoveryService.get(id);
    return ok(
        request,
        "Product details retrieved",
        new ProductDetailsResponse(product, reviewService.rating(product.id())));
  }
}
