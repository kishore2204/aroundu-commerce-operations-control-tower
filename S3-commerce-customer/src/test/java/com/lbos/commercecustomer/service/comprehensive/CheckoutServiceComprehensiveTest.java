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
class CheckoutServiceComprehensiveTest {
CartServiceImpl cart;CustomerAddressRepository addresses;ContextSupport ctx;OrderLogisticsClient order;FinanceClient finance;ProductRepository products;CustomerProfileRepository customers;CheckoutServiceImpl service;CustomerProfile customer;CustomerAddress address;UUID retailerId;CartItemResponse line;
/* prepare() now prices the cart per retailer: it groups the cart lines by retailerId and calls
 * S6 tax + picks the S4 delivery charge once per group. An empty cart therefore produces zero
 * groups and zero external calls, so the fixture has to carry a real cart line (one retailer,
 * 1 x 100.00) for these tests to exercise the pricing path at all. */
@BeforeEach void setup(){cart=mock(CartServiceImpl.class);addresses=mock(CustomerAddressRepository.class);ctx=mock(ContextSupport.class);order=mock(OrderLogisticsClient.class);finance=mock(FinanceClient.class);products=mock(ProductRepository.class);when(products.findCategoryRefsByProductIds(any())).thenReturn(List.of(new ProductCategoryRef(1L,5L)));customers=mock(CustomerProfileRepository.class);customer=new CustomerProfile();customer.setId(UUID.randomUUID());address=new CustomerAddress();address.setId(UUID.randomUUID());address.setCustomer(customer);address.setCityId(UUID.randomUUID());retailerId=UUID.randomUUID();line=new CartItemResponse(UUID.randomUUID(),1L,"Cold Brew",retailerId,"Corner Shop",1,new BigDecimal("100.00"),new BigDecimal("100.00"),10,true);when(ctx.customer()).thenReturn(customer);when(addresses.findByIdAndCustomerId(address.getId(),customer.getId())).thenReturn(Optional.of(address));when(cart.validate()).thenReturn(new CartValidationResponse(new CartResponse(List.of(line),1,1,new BigDecimal("100.00")),true,List.of()));service=new CheckoutServiceImpl(cart,addresses,ctx,order,finance,new FeignCallSupport(),customers,products);}
/* Delivery is taken from the per-line S4 verdict for that retailer (not the response-level
 * deliveryCharge), so the serviceability stub carries a line for this cart's retailer.
 * subtotal 100.00 + tax 5 + delivery 20 + 2% platform fee 2.00 = 127.00. */
/* Regression test for a confirmed bug: prepare() used to persist a reward-points balance
 * change on every call, so simply reloading the checkout page (or the checkout flow's own
 * "re-check right before payment" call) credited points repeatedly with no order ever placed.
 * A live network trace proved this: calling prepare() three times in a row raised the stored
 * balance every time. prepare() must never write - only confirm() (called once, after the
 * order actually exists) may. */
@Test void prepareNeverPersistsPointsEvenAcrossManyCalls(){
    when(order.serviceability(any())).thenReturn(new ServiceabilityResponse(true,new BigDecimal("20"),"30m",null,List.of(new LineServiceabilityResult(1L,retailerId,true,null,new BigDecimal("20"),"30m"))));
    when(finance.tax(any())).thenReturn(new TaxCalculationResponse(BigDecimal.ZERO,new BigDecimal("5"),new BigDecimal("5"),"INR"));
    service.prepare(new CheckoutRequest(address.getId(),null));
    service.prepare(new CheckoutRequest(address.getId(),null));
    service.prepare(new CheckoutRequest(address.getId(),null));
    verify(customers,never()).save(any());
}
@Test void confirmPersistsPointsExactlyOnce(){
    when(order.serviceability(any())).thenReturn(new ServiceabilityResponse(true,new BigDecimal("20"),"30m",null,List.of(new LineServiceabilityResult(1L,retailerId,true,null,new BigDecimal("20"),"30m"))));
    when(finance.tax(any())).thenReturn(new TaxCalculationResponse(BigDecimal.ZERO,new BigDecimal("5"),new BigDecimal("5"),"INR"));
    var response=service.confirm(new CheckoutRequest(address.getId(),null));
    assertEquals(new BigDecimal("2.54"),response.pointsEarned());
    assertEquals(new BigDecimal("2.54"),customer.getRewardPointsBalance());
    verify(customers,times(1)).save(customer);
}
@Test void preparePositive(){when(order.serviceability(any())).thenReturn(new ServiceabilityResponse(true,new BigDecimal("20"),"30m",null,List.of(new LineServiceabilityResult(1L,retailerId,true,null,new BigDecimal("20"),"30m"))));when(finance.tax(any())).thenReturn(new TaxCalculationResponse(BigDecimal.ZERO,new BigDecimal("5"),new BigDecimal("5"),"INR"));var response=service.prepare(new CheckoutRequest(address.getId(),null));assertEquals(new BigDecimal("127.00"),response.grandTotal());assertEquals(1,response.retailerBreakdowns().size());var breakdown=response.retailerBreakdowns().get(0);assertEquals(retailerId,breakdown.retailerId());assertEquals(new BigDecimal("100.00"),breakdown.subtotal());assertEquals(new BigDecimal("5"),breakdown.tax());assertEquals(new BigDecimal("20"),breakdown.deliveryCharge());assertEquals(new BigDecimal("2.00"),breakdown.platformFee());assertEquals(new BigDecimal("127.00"),breakdown.grandTotal());}
@Test void prepareNegativeAddressMissing(){when(addresses.findByIdAndCustomerId(any(),any())).thenReturn(Optional.empty());assertThrows(ResourceNotFoundException.class,()->service.prepare(new CheckoutRequest(UUID.randomUUID(),null)));}
/*
 * Per-product/retailer serviceability (see requirement that a multi-retailer cart must be
 * checked, and shown, one line at a time) means prepare() no longer throws when the cart isn't
 * fully serviceable - it surfaces serviceable=false and the per-line breakdown instead, and
 * only the actual place-order step (frontend-orchestrated, see OrderService.submit()) blocks
 * on it. See CheckoutServiceImpl.prepare().
 */
@Test void prepareNegativeNotServiceableSurfacesFalseRatherThanThrowing(){when(order.serviceability(any())).thenReturn(new ServiceabilityResponse(false,null,null,"NO_ROUTE",List.of()));when(finance.tax(any())).thenReturn(new TaxCalculationResponse(BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ZERO,"INR"));var response=service.prepare(new CheckoutRequest(address.getId(),null));assertFalse(response.serviceable());}
@Test void prepareBoundaryNullTaxResponseBlocksCheckout(){when(order.serviceability(any())).thenReturn(new ServiceabilityResponse(true,BigDecimal.ZERO,null,null,List.of()));when(finance.tax(any())).thenReturn(null);assertThrows(BusinessValidationException.class,()->service.prepare(new CheckoutRequest(address.getId(),null)));}
@Test void prepareSendsProductCategoryToTax(){when(order.serviceability(any())).thenReturn(new ServiceabilityResponse(true,BigDecimal.ZERO,null,null,List.of()));when(finance.tax(any())).thenReturn(new TaxCalculationResponse(BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ZERO,"INR"));service.prepare(new CheckoutRequest(address.getId(),null));var captor=org.mockito.ArgumentCaptor.forClass(TaxCalculationRequest.class);verify(finance).tax(captor.capture());var item=captor.getValue().items().get(0);assertEquals(1L,item.productId());assertEquals(5L,item.productCategoryId());assertEquals(1,item.quantity());assertEquals(new BigDecimal("100.00"),item.unitPrice());verify(products,times(1)).findCategoryRefsByProductIds(any());}
@Test void prepareWithoutApplicableTaxConfigurationBlocksCheckoutWithTheClearMessage(){when(order.serviceability(any())).thenReturn(new ServiceabilityResponse(true,BigDecimal.ZERO,null,null,List.of()));var body="{\"status\":409,\"message\":\"No applicable tax configuration found for product category Groceries\"}";var rejected=feign.FeignException.errorStatus("tax",feign.Response.builder().status(409).reason("Conflict").request(feign.Request.create(feign.Request.HttpMethod.POST,"http://lbos-finance/x",Map.of(),null,null,null)).headers(Map.of()).body(body,java.nio.charset.StandardCharsets.UTF_8).build());when(finance.tax(any())).thenThrow(rejected);var ex=assertThrows(BusinessValidationException.class,()->service.prepare(new CheckoutRequest(address.getId(),null)));assertTrue(ex.getMessage().startsWith("No applicable tax configuration found"));}
@Test void prepareBoundaryNullDeliveryChargeUsesZero(){when(order.serviceability(any())).thenReturn(new ServiceabilityResponse(true,null,null,null,List.of()));when(finance.tax(any())).thenReturn(new TaxCalculationResponse(BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ZERO,"INR"));assertEquals(BigDecimal.ZERO,service.prepare(new CheckoutRequest(address.getId(),null)).deliveryCharge());}
@Test void prepareCallsCartValidation(){when(order.serviceability(any())).thenReturn(new ServiceabilityResponse(true,BigDecimal.ZERO,null,null,List.of()));when(finance.tax(any())).thenReturn(new TaxCalculationResponse(BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ZERO,"INR"));service.prepare(new CheckoutRequest(address.getId(),null));verify(cart).validate();}
@Test void prepareCallsExternalTaxAndServiceability(){when(order.serviceability(any())).thenReturn(new ServiceabilityResponse(true,BigDecimal.ZERO,null,null,List.of()));when(finance.tax(any())).thenReturn(new TaxCalculationResponse(BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ZERO,"INR"));service.prepare(new CheckoutRequest(address.getId(),null));verify(order).serviceability(any());verify(finance).tax(any());}
}