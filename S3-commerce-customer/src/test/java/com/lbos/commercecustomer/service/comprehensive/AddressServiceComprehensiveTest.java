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
class AddressServiceComprehensiveTest {
CustomerAddressRepository repo;ContextSupport ctx;PlatformTerritoryClient platform;AddressServiceImpl service;CustomerProfile customer;
@BeforeEach void setup(){repo=mock(CustomerAddressRepository.class);ctx=mock(ContextSupport.class);platform=mock(PlatformTerritoryClient.class);service=new AddressServiceImpl(repo,ctx,platform,new CommerceMapper(),new FeignCallSupport(),mock(CustomerCartItemRepository.class));customer=new CustomerProfile();customer.setId(UUID.randomUUID());when(ctx.customer()).thenReturn(customer);when(platform.validate(any())).thenReturn(new TerritoryValidationResponse(true,null));UUID cityId=UUID.randomUUID();UUID zoneId=UUID.randomUUID();when(platform.cities(any())).thenReturn(List.of(new CityLookupResponse(cityId,"TestCity",UUID.randomUUID(),"TestState")));when(platform.zones(any(),any())).thenReturn(List.of(new ZoneLookupResponse(zoneId,"TestZone",cityId)));}
@Test void createPositiveFirstAddressBecomesDefault(){when(repo.findByCustomerIdOrderByIdAsc(customer.getId())).thenReturn(List.of());when(repo.save(any())).thenAnswer(invocation->{CustomerAddress savedAddress=invocation.getArgument(0);savedAddress.setId(UUID.randomUUID());return savedAddress;});assertTrue(service.create(request(false)).defaultAddress());}
@Test void createNegativeInvalidTerritory(){when(platform.validate(any())).thenReturn(new TerritoryValidationResponse(false,"INVALID_ZONE"));assertThrows(BusinessValidationException.class,()->service.create(request(false)));}
@Test void getNegativeForeignAddressHidden(){when(repo.findByIdAndCustomerId(any(),eq(customer.getId()))).thenReturn(Optional.empty());assertThrows(ResourceNotFoundException.class,()->service.get(UUID.randomUUID()));}
@Test void updatePositiveTrimsAddress(){var existingAddress=address(false);when(repo.findByIdAndCustomerId(existingAddress.getId(),customer.getId())).thenReturn(Optional.of(existingAddress));when(repo.save(existingAddress)).thenReturn(existingAddress);assertEquals("Line 1",service.update(existingAddress.getId(),request(false)).line1());}
@Test void setDefaultPositiveClearsOld(){var old=address(true);var next=address(false);when(repo.findByIdAndCustomerId(next.getId(),customer.getId())).thenReturn(Optional.of(next));when(repo.findByCustomerIdAndDefaultAddressTrue(customer.getId())).thenReturn(Optional.of(old));when(repo.save(any())).thenAnswer(invocation->invocation.getArgument(0));assertTrue(service.setDefault(next.getId()).defaultAddress());assertFalse(old.isDefaultAddress());}
@Test void deleteNegativeOnlyDefault(){var existingAddress=address(true);when(repo.findByIdAndCustomerId(existingAddress.getId(),customer.getId())).thenReturn(Optional.of(existingAddress));when(repo.findByCustomerIdOrderByIdAsc(customer.getId())).thenReturn(List.of(existingAddress));assertThrows(BusinessValidationException.class,()->service.delete(existingAddress.getId()));}
@Test void deletePositiveDefaultReassigned(){var existingAddress=address(true);var other=address(false);when(repo.findByIdAndCustomerId(existingAddress.getId(),customer.getId())).thenReturn(Optional.of(existingAddress));when(repo.findByCustomerIdOrderByIdAsc(customer.getId())).thenReturn(List.of(existingAddress,other));service.delete(existingAddress.getId());assertTrue(other.isDefaultAddress());}
@Test void listBoundaryEmpty(){when(repo.findByCustomerIdOrderByIdAsc(customer.getId())).thenReturn(List.of());assertEquals(0,service.list(0,20).totalElements());}
private AddressRequest request(boolean isDefault){return new AddressRequest("TestCity","TestZone","HOME"," Line 1 ",null,"600001",null,null,isDefault);}private CustomerAddress address(boolean isDefault){var newAddress=new CustomerAddress();newAddress.setId(UUID.randomUUID());newAddress.setCustomer(customer);newAddress.setDefaultAddress(isDefault);return newAddress;}
}
