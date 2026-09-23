package com.lbos.commercecustomer.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.lbos.commercecustomer.client.OrderLogisticsClient;
import com.lbos.commercecustomer.client.PartnerVerificationClient;
import com.lbos.commercecustomer.dto.response.ProductDetailsResponse;
import com.lbos.commercecustomer.entity.CustomerReview;
import com.lbos.commercecustomer.entity.Product;
import com.lbos.commercecustomer.entity.ProductCategory;
import com.lbos.commercecustomer.enums.InventoryStatus;
import com.lbos.commercecustomer.exception.ResourceNotFoundException;
import com.lbos.commercecustomer.mapper.CommerceMapper;
import com.lbos.commercecustomer.repository.CustomerReviewRepository;
import com.lbos.commercecustomer.repository.ProductRepository;
import com.lbos.commercecustomer.service.impl.ContextSupport;
import com.lbos.commercecustomer.service.impl.FeignCallSupport;
import com.lbos.commercecustomer.service.impl.ProductDiscoveryServiceImpl;
import com.lbos.commercecustomer.service.impl.RetailerEnrichmentSupport;
import com.lbos.commercecustomer.service.impl.ReviewServiceImpl;
import jakarta.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

/**
 * Exercises GET /api/v1/products/{id}/details through the real discovery and review
 * services (only the repositories are mocked), so the zero-review rating semantics are
 * genuinely verified rather than stubbed.
 */
class ProductDetailsEndpointTest {

  private static final long PRODUCT_ID = 7L;
  private static final UUID RETAILER_ID = UUID.randomUUID();

  private ProductRepository productRepository;
  private CustomerReviewRepository reviewRepository;
  private PartnerVerificationClient partnerVerificationClient;
  private ProductController controller;
  private HttpServletRequest httpRequest;

  @BeforeEach
  void setUp() {
    productRepository = mock(ProductRepository.class);
    reviewRepository = mock(CustomerReviewRepository.class);
    partnerVerificationClient = mock(PartnerVerificationClient.class);
    // Customer-facing product reads hide products belonging to a retailer that is not currently
    // open for orders, so S2 has to report this product's retailer in its open-now list.
    when(partnerVerificationClient.openRetailerIds()).thenReturn(List.of(RETAILER_ID));
    CommerceMapper mapper = new CommerceMapper();
    controller =
        new ProductController(
            new ProductDiscoveryServiceImpl(
                productRepository,
                mapper,
                new RetailerEnrichmentSupport(partnerVerificationClient, new FeignCallSupport())),
            new ReviewServiceImpl(
                reviewRepository,
                productRepository,
                mock(ContextSupport.class),
                mock(OrderLogisticsClient.class),
                mapper,
                new FeignCallSupport()));
    httpRequest = mock(HttpServletRequest.class);
    when(httpRequest.getHeader("X-Correlation-Id")).thenReturn("corr-1");
  }

  private Product activeProduct() {
    ProductCategory category = new ProductCategory();
    category.setId(3L);
    category.setName("Beverages");
    Product product = new Product();
    product.setId(PRODUCT_ID);
    product.setName("Cold Brew");
    product.setSku("CB-001");
    product.setCategory(category);
    product.setRetailerId(RETAILER_ID);
    product.setUnitPrice(new BigDecimal("249.00"));
    product.setStock(25);
    product.setStatus(com.lbos.commercecustomer.enums.ProductStatus.ACTIVE);
    return product;
  }

  private CustomerReview reviewWithRating(short rating) {
    CustomerReview review = new CustomerReview();
    review.setId(UUID.randomUUID());
    review.setOrderId(100L);
    review.setRating(rating);
    return review;
  }

  @Test
  void detailsReturnsProductAndRatingSummaryInOneCall() {
    when(productRepository.findById(PRODUCT_ID)).thenReturn(Optional.of(activeProduct()));
    when(reviewRepository.average(PRODUCT_ID)).thenReturn(4.5d);
    when(reviewRepository.countByProductId(PRODUCT_ID)).thenReturn(2L);
    when(reviewRepository.findByProductId(eq(PRODUCT_ID), any(Pageable.class)))
        .thenReturn(new PageImpl<>(List.of(reviewWithRating((short) 4), reviewWithRating((short) 5))));

    ProductDetailsResponse details = controller.details(PRODUCT_ID, httpRequest).data();

    assertEquals(PRODUCT_ID, details.product().id());
    assertEquals("Cold Brew", details.product().name());
    assertEquals("Beverages", details.product().categoryName());
    assertEquals(new BigDecimal("249.00"), details.product().unitPrice());
    assertEquals(25, details.product().stock());
    assertEquals(InventoryStatus.HEALTHY, details.product().inventoryStatus());
    assertEquals(PRODUCT_ID, details.ratingSummary().productId());
    assertEquals(4.5d, details.ratingSummary().average());
    assertEquals(2L, details.ratingSummary().count());
    assertEquals(1L, details.ratingSummary().distribution().get((short) 4));
    assertEquals(1L, details.ratingSummary().distribution().get((short) 5));
    assertEquals(0L, details.ratingSummary().distribution().get((short) 1));
  }

  @Test
  void detailsReturnsZeroRatingSummaryWhenProductHasNoReviews() {
    when(productRepository.findById(PRODUCT_ID)).thenReturn(Optional.of(activeProduct()));
    when(reviewRepository.average(PRODUCT_ID)).thenReturn(null);
    when(reviewRepository.countByProductId(PRODUCT_ID)).thenReturn(0L);
    when(reviewRepository.findByProductId(eq(PRODUCT_ID), any(Pageable.class)))
        .thenReturn(new PageImpl<>(List.of()));

    ProductDetailsResponse details = controller.details(PRODUCT_ID, httpRequest).data();

    assertEquals(PRODUCT_ID, details.product().id());
    assertEquals(0d, details.ratingSummary().average());
    assertEquals(0L, details.ratingSummary().count());
    assertEquals(5, details.ratingSummary().distribution().size());
    for (short rating = 1; rating <= 5; rating++) {
      assertEquals(0L, details.ratingSummary().distribution().get(rating));
    }
  }

  @Test
  void detailsHidesNonActiveProduct() {
    Product draft = activeProduct();
    draft.setStatus(com.lbos.commercecustomer.enums.ProductStatus.DRAFT);
    when(productRepository.findById(PRODUCT_ID)).thenReturn(Optional.of(draft));

    assertThrows(ResourceNotFoundException.class, () -> controller.details(PRODUCT_ID, httpRequest));
  }

  @Test
  void plainGetContractStillReturnsProductResponseOnly() {
    when(productRepository.findById(PRODUCT_ID)).thenReturn(Optional.of(activeProduct()));

    assertEquals(PRODUCT_ID, controller.get(PRODUCT_ID, httpRequest).data().id());
  }
}
