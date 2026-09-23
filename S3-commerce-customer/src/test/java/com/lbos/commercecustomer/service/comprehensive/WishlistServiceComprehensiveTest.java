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
class WishlistServiceComprehensiveTest {
CustomerWishlistItemRepository repo;ProductRepository products;ContextSupport ctx;WishlistServiceImpl service;CustomerProfile customer;
@BeforeEach void setup(){repo=mock(CustomerWishlistItemRepository.class);products=mock(ProductRepository.class);ctx=mock(ContextSupport.class);customer=new CustomerProfile();customer.setId(UUID.randomUUID());when(ctx.customer()).thenReturn(customer);service=new WishlistServiceImpl(repo,products,ctx,new CommerceMapper(),new RetailerEnrichmentSupport(mock(PartnerVerificationClient.class),new FeignCallSupport()));}
@Test void addPositive(){var p=product(1L,1);when(products.findById(1L)).thenReturn(Optional.of(p));when(repo.save(any())).thenAnswer(a->{CustomerWishlistItem e=a.getArgument(0);e.setId(UUID.randomUUID());return e;});assertEquals(1L,service.add(new ReplaceWishlistProductRequest(1L)).product().id());}
@Test void addNegativeDuplicate(){when(repo.existsByCustomerIdAndProductId(customer.getId(),1L)).thenReturn(true);assertThrows(DuplicateResourceException.class,()->service.add(new ReplaceWishlistProductRequest(1L)));}
@Test void addNegativeMissingProduct(){when(products.findById(1L)).thenReturn(Optional.empty());assertThrows(ResourceNotFoundException.class,()->service.add(new ReplaceWishlistProductRequest(1L)));}
@Test void replaceNegativeDuplicateTarget(){var e=item(1L);when(repo.findByIdAndCustomerId(e.getId(),customer.getId())).thenReturn(Optional.of(e));when(repo.existsByCustomerIdAndProductId(customer.getId(),2L)).thenReturn(true);assertThrows(DuplicateResourceException.class,()->service.replace(e.getId(),new ReplaceWishlistProductRequest(2L)));}
@Test void deletePositiveOwned(){var e=item(1L);when(repo.findByIdAndCustomerId(e.getId(),customer.getId())).thenReturn(Optional.of(e));service.delete(e.getId());verify(repo).delete(e);}
@Test void getNegativeForeignHidden(){when(repo.findByIdAndCustomerId(any(),eq(customer.getId()))).thenReturn(Optional.empty());assertThrows(ResourceNotFoundException.class,()->service.get(UUID.randomUUID()));}
@Test void membershipBoundaryEmpty(){assertTrue(service.membership(List.of()).isEmpty());}
@Test void summaryBoundaryCountsAvailability(){var a=item(1L);var b=item(2L);b.getProduct().setStock(0);when(repo.findByCustomerId(eq(customer.getId()),any())).thenReturn(new PageImpl<>(List.of(a,b)));var s=service.summary();assertEquals(2,s.total());assertEquals(1,s.outOfStock());}
private Product product(Long id,int stock){var c=new ProductCategory();c.setId(1L);c.setName("Food");var p=new Product();p.setId(id);p.setName("P");p.setSku("S"+id);p.setUnitPrice(BigDecimal.ONE);p.setStatus(ProductStatus.ACTIVE);p.setStock(stock);p.setCategory(c);return p;}private CustomerWishlistItem item(Long id){var e=new CustomerWishlistItem();e.setId(UUID.randomUUID());e.setCustomer(customer);e.setProduct(product(id,1));return e;}
}