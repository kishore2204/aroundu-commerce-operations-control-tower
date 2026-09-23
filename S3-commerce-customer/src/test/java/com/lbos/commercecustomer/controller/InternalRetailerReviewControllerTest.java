package com.lbos.commercecustomer.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import com.lbos.commercecustomer.entity.CustomerReview;
import com.lbos.commercecustomer.entity.Product;
import com.lbos.commercecustomer.repository.CustomerReviewRepository;

@ExtendWith(MockitoExtension.class)
class InternalRetailerReviewControllerTest {

    @Mock private CustomerReviewRepository reviews;
    @InjectMocks private InternalRetailerReviewController controller;

    private static CustomerReviewRepository.RetailerRatingRow row(UUID retailerId, Double average, Long total) {
        return new CustomerReviewRepository.RetailerRatingRow() {
            public UUID getRetailerId() { return retailerId; }
            public Double getAverage() { return average; }
            public Long getTotal() { return total; }
        };
    }

    @Test
    void ratingsForManyRetailersComeFromOneGroupedQuery() {
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        when(reviews.ratingsByRetailerIds(any())).thenReturn(List.of(row(first, 4.5, 12L), row(second, null, null)));

        var result = controller.ratingSummaries(new InternalRetailerReviewController.RatingSummariesRequest(List.of(first, second)));

        assertEquals(2, result.size());
        assertEquals(4.5, result.get(0).average());
        assertEquals(12L, result.get(0).count());
        assertEquals(0.0, result.get(1).average());
    }

    @Test
    void noRetailersMeansNoQuery() {
        assertTrue(controller.ratingSummaries(new InternalRetailerReviewController.RatingSummariesRequest(List.of())).isEmpty());
        verifyNoInteractions(reviews);
    }

    @Test
    void reviewsArePagedAndCarryNoCustomerIdentity() {
        UUID retailerId = UUID.randomUUID();
        Product product = new Product();
        product.setName("Basmati Rice 5kg");
        CustomerReview review = new CustomerReview();
        review.setProduct(product);
        review.setRating((short) 4);
        review.setText("Fresh and well packed");
        when(reviews.pageByRetailerId(any(), any())).thenReturn(new PageImpl<>(List.of(review), PageRequest.of(0, 50), 1));

        var page = controller.reviewsOf(retailerId, 0, 500);

        assertEquals(1, page.items().size());
        assertEquals("Basmati Rice 5kg", page.items().get(0).productName());
        assertEquals("Fresh and well packed", page.items().get(0).comment());
        ArgumentCaptor<Pageable> requested = ArgumentCaptor.forClass(Pageable.class);
        org.mockito.Mockito.verify(reviews).pageByRetailerId(any(), requested.capture());
        assertEquals(50, requested.getValue().getPageSize(), "page size is capped");
    }
}
