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
class CartServiceComprehensiveTest {
CustomerCartRepository carts;CustomerCartItemRepository items;ProductRepository products;ContextSupport ctx;WishlistServiceImpl wishlist;CartServiceImpl service;CustomerProfile customer;CustomerAddressRepository addresses;OrderLogisticsClient order;
@BeforeEach void setup(){carts=mock(CustomerCartRepository.class);items=mock(CustomerCartItemRepository.class);products=mock(ProductRepository.class);ctx=mock(ContextSupport.class);wishlist=mock(WishlistServiceImpl.class);addresses=mock(CustomerAddressRepository.class);order=mock(OrderLogisticsClient.class);customer=new CustomerProfile();customer.setId(UUID.randomUUID());when(ctx.customer()).thenReturn(customer);mockServiceableActiveAddress();service=new CartServiceImpl(carts,items,products,ctx,wishlist,addresses,order,new FeignCallSupport(),new RetailerEnrichmentSupport(mock(PartnerVerificationClient.class),new FeignCallSupport()));}
/** CartServiceImpl.add() requires an active (default) delivery address whose zone S4 reports as
 * serviceable for the product - stub both so add-to-cart tests exercise stock/status rules
 * rather than tripping over that precondition. */
private void mockServiceableActiveAddress(){var address=new CustomerAddress();address.setId(UUID.randomUUID());address.setCustomer(customer);address.setCityId(UUID.randomUUID());address.setZoneId(UUID.randomUUID());address.setDefaultAddress(true);when(addresses.findByCustomerIdAndDefaultAddressTrue(customer.getId())).thenReturn(Optional.of(address));when(order.serviceability(any())).thenAnswer(a->{ServiceabilityRequest r=a.getArgument(0);return new ServiceabilityResponse(true,BigDecimal.ZERO,"30m",null,r.productIds().stream().map(id->new LineServiceabilityResult(id,UUID.randomUUID(),true,null,BigDecimal.ZERO,"30m")).toList());});}
@Test void addPositiveExactStock(){mockAdd(5);assertEquals(5,service.add(new CartItemRequest(1L,5)).quantity());}
@Test void addNegativeOverStock(){mockProduct(5);assertThrows(BusinessValidationException.class,()->service.add(new CartItemRequest(1L,6)));}
@Test void addNegativeInactive(){var p=mockProduct(5);p.setStatus(ProductStatus.DRAFT);assertThrows(BusinessValidationException.class,()->service.add(new CartItemRequest(1L,1)));}
@Test void updateNegativeProductCannotChange(){var i=item(1);when(items.findByIdAndCartCustomerId(i.getId(),customer.getId())).thenReturn(Optional.of(i));assertThrows(BusinessValidationException.class,()->service.update(i.getId(),new CartItemRequest(2L,1)));}
@Test void updateBoundaryEqualsStock(){var i=item(1);i.getCart().getProduct().setStock(5);when(items.findByIdAndCartCustomerId(i.getId(),customer.getId())).thenReturn(Optional.of(i));when(items.save(i)).thenReturn(i);assertEquals(5,service.update(i.getId(),new CartItemRequest(1L,5)).quantity());}
@Test void clearPositiveDeletesItemsAndCarts(){when(carts.findByCustomerId(customer.getId())).thenReturn(List.of());service.clear();verify(items).deleteByCartCustomerId(customer.getId());}
/** validate() reports ALL bad lines instead of throwing on the first one, so an over-stock line
 * must come back as an INSUFFICIENT_STOCK issue with valid=false. */
@Test void validateNegativeQuantityOverStock(){var i=item(6);i.getCart().getProduct().setStock(5);when(items.findWithCartAndProductByCartCustomerId(customer.getId())).thenReturn(List.of(i));var result=service.validate();assertFalse(result.valid());assertEquals(1,result.issues().size());assertEquals("INSUFFICIENT_STOCK",result.issues().get(0).issueCode());assertEquals(1L,result.issues().get(0).productId());}
private Product mockProduct(int stock){var p=new Product();p.setId(1L);p.setName("P");p.setStatus(ProductStatus.ACTIVE);p.setStock(stock);p.setUnitPrice(BigDecimal.ONE);p.setRetailerId(UUID.randomUUID());when(products.findById(1L)).thenReturn(Optional.of(p));return p;}private void mockAdd(int stock){var p=mockProduct(stock);when(carts.findByCustomerIdAndProductId(customer.getId(),1L)).thenReturn(Optional.empty());when(carts.save(any())).thenAnswer(a->{CustomerCart c=a.getArgument(0);c.setId(UUID.randomUUID());return c;});when(items.findByCartId(any())).thenReturn(Optional.empty());when(items.save(any())).thenAnswer(a->{CustomerCartItem i=a.getArgument(0);i.setId(UUID.randomUUID());return i;});}private CustomerCartItem item(int q){var p=mockProduct(5);var c=new CustomerCart();c.setId(UUID.randomUUID());c.setCustomer(customer);c.setProduct(p);var i=new CustomerCartItem();i.setId(UUID.randomUUID());i.setCart(c);i.setQuantity(q);return i;}
}