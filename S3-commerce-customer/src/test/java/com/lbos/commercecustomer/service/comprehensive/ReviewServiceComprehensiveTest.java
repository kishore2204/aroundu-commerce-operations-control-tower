package com.lbos.commercecustomer.service.comprehensive;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.data.domain.*;
import com.lbos.commercecustomer.client.*;
import com.lbos.commercecustomer.dto.client.finance.*;
import com.lbos.commercecustomer.dto.client.order.*;
import com.lbos.commercecustomer.dto.client.partner.*;
import com.lbos.commercecustomer.dto.client.platform.*;
import com.lbos.commercecustomer.dto.request.*;
import com.lbos.commercecustomer.dto.response.*;
import com.lbos.commercecustomer.entity.*;
import com.lbos.commercecustomer.enums.*;
import com.lbos.commercecustomer.exception.*;
import com.lbos.commercecustomer.mapper.CommerceMapper;
import com.lbos.commercecustomer.repository.*;
import com.lbos.commercecustomer.service.impl.*;
class ReviewServiceComprehensiveTest {
CustomerReviewRepository repo;ProductRepository products;ContextSupport ctx;OrderLogisticsClient order;ReviewServiceImpl service;CustomerProfile customer;
@BeforeEach void setup(){repo=mock(CustomerReviewRepository.class);products=mock(ProductRepository.class);ctx=mock(ContextSupport.class);order=mock(OrderLogisticsClient.class);customer=new CustomerProfile();customer.setId(UUID.randomUUID());when(ctx.customer()).thenReturn(customer);service=new ReviewServiceImpl(repo,products,ctx,order,new CommerceMapper(),new FeignCallSupport());}
@Test void createPositiveVerifiedPurchase(){when(order.reviewEligibility(1L,customer.getId(),2L)).thenReturn(new ReviewEligibilityResponse(true,1L,customer.getId(),2L,null));when(products.findById(2L)).thenReturn(Optional.of(product()));when(repo.save(any())).thenAnswer(a->{CustomerReview r=a.getArgument(0);r.setId(UUID.randomUUID());return r;});assertEquals(5,service.create(new ReviewRequest(1L,2L,(short)5,"Great")).rating());}
@Test void createNegativeNotEligible(){when(order.reviewEligibility(anyLong(),any(),anyLong())).thenReturn(new ReviewEligibilityResponse(false,1L,customer.getId(),2L,"NO_PURCHASE"));assertThrows(ForbiddenOperationException.class,()->service.create(new ReviewRequest(1L,2L,(short)5,"Great")));}
@Test void createNegativeDuplicate(){when(order.reviewEligibility(anyLong(),any(),anyLong())).thenReturn(new ReviewEligibilityResponse(true,1L,customer.getId(),2L,null));when(repo.existsByOrderIdAndProductId(1L,2L)).thenReturn(true);assertThrows(DuplicateResourceException.class,()->service.create(new ReviewRequest(1L,2L,(short)5,"Great")));}
@Test void getNegativeMissing(){when(repo.findById(any())).thenReturn(Optional.empty());assertThrows(ResourceNotFoundException.class,()->service.get(UUID.randomUUID()));}
@Test void updateBoundaryRatingOne(){var r=review();when(products.findById(2L)).thenReturn(Optional.of(r.getProduct()));when(repo.findById(r.getId())).thenReturn(Optional.of(r));when(order.reviewEligibility(anyLong(),any(),anyLong())).thenReturn(new ReviewEligibilityResponse(true,1L,customer.getId(),2L,null));when(repo.save(r)).thenReturn(r);assertEquals(1,service.update(r.getId(),new UpdateReviewRequest((short)1,"Okay")).rating());}
@Test void updateBoundaryRatingFive(){var r=review();when(products.findById(2L)).thenReturn(Optional.of(r.getProduct()));when(repo.findById(r.getId())).thenReturn(Optional.of(r));when(order.reviewEligibility(anyLong(),any(),anyLong())).thenReturn(new ReviewEligibilityResponse(true,1L,customer.getId(),2L,null));when(repo.save(r)).thenReturn(r);assertEquals(5,service.update(r.getId(),new UpdateReviewRequest((short)5,"Great")).rating());}
@Test void ratingBoundaryNoReviewsReturnsZero(){when(repo.average(2L)).thenReturn(null);when(repo.findByProductId(eq(2L),any())).thenReturn(Page.empty());assertEquals(0d,service.rating(2L).average());}
private Product product(){var p=new Product();p.setId(2L);return p;}
/** create() stamps the authenticated caller onto the review, and update()/delete() re-check it via
 * ownedByCaller(), so a persisted-review fixture must carry the owning customer id too. */
private CustomerReview review(){var r=new CustomerReview();r.setId(UUID.randomUUID());r.setOrderId(1L);r.setProduct(product());r.setCustomerId(customer.getId());r.setRating((short)3);return r;}
}