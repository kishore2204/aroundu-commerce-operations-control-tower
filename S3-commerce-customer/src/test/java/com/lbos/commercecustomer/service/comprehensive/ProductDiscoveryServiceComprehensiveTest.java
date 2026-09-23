package com.lbos.commercecustomer.service.comprehensive;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
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
class ProductDiscoveryServiceComprehensiveTest {
ProductRepository repo;ProductDiscoveryServiceImpl service;PartnerVerificationClient partner;
@BeforeEach void setup(){repo=mock(ProductRepository.class);partner=mock(PartnerVerificationClient.class);service=new ProductDiscoveryServiceImpl(repo,new CommerceMapper(),new RetailerEnrichmentSupport(partner,new FeignCallSupport()));}
/** get() hides products whose retailer is not currently open for orders, so an "open store" has
 * to be represented by S2 reporting that retailer id in its open-now list. */
private void storeOpen(Product p){when(partner.openRetailerIds()).thenReturn(List.of(p.getRetailerId()));}
@Test void getPositiveActive(){var p=product(ProductStatus.ACTIVE,1);storeOpen(p);when(repo.findById(1L)).thenReturn(Optional.of(p));assertEquals(1L,service.get(1L).id());}
@Test void getNegativeDraftHidden(){when(repo.findById(1L)).thenReturn(Optional.of(product(ProductStatus.DRAFT,1)));assertThrows(ResourceNotFoundException.class,()->service.get(1L));}
@Test void getNegativeMissing(){when(repo.findById(1L)).thenReturn(Optional.empty());assertThrows(ResourceNotFoundException.class,()->service.get(1L));}
// search() now applies its filters as a DB-level Specification (see ProductDiscoveryServiceImpl / item 3 of the fix list) instead of
// filtering an already-fetched page in memory, so a mocked repository can no longer exercise the actual filtering semantics here -
// these stubs just keep the plumbing (page/size passthrough) exercised without asserting on filter predicates the DB would apply.
@Test void searchPositiveName(){when(repo.findAll(any(Specification.class),any(Pageable.class))).thenReturn(new PageImpl<>(List.of(product(ProductStatus.ACTIVE,2))));assertEquals(1,service.search("rice",null,null,null,null,0,20).items().size());}
@Test void searchBoundaryEmptyPage(){when(repo.findAll(any(Specification.class),any(Pageable.class))).thenReturn(Page.empty());assertEquals(0,service.search(null,null,null,null,null,0,20).totalElements());}
@Test void searchRetailerFilter(){var p=product(ProductStatus.ACTIVE,1);UUID r=p.getRetailerId();when(repo.findAll(any(Specification.class),any(Pageable.class))).thenReturn(new PageImpl<>(List.of(p)));assertEquals(1,service.search(null,null,r,null,null,0,20).items().size());}
private Product product(ProductStatus status,int stock){var c=new ProductCategory();c.setId(1L);c.setName("Food");var p=new Product();p.setId(1L);p.setName("Rice");p.setSku("RICE");p.setDescription("Long rice description");p.setStatus(status);p.setStock(stock);p.setUnitPrice(BigDecimal.TEN);p.setCategory(c);p.setRetailerId(UUID.randomUUID());return p;}
}