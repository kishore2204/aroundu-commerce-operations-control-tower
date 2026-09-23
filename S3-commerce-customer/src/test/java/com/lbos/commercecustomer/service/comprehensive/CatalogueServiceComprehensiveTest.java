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
class CatalogueServiceComprehensiveTest {
ProductRepository repo;ProductCategoryRepository cats;CustomerWishlistItemRepository wish;CustomerCartRepository carts;CustomerReviewRepository reviews;ContextSupport ctx;CatalogueServiceImpl service;UUID retailer;
@BeforeEach void setup(){repo=mock(ProductRepository.class);cats=mock(ProductCategoryRepository.class);wish=mock(CustomerWishlistItemRepository.class);carts=mock(CustomerCartRepository.class);reviews=mock(CustomerReviewRepository.class);ctx=mock(ContextSupport.class);retailer=UUID.randomUUID();when(ctx.retailer()).thenReturn(new RetailerContextResponse(retailer,UUID.randomUUID(),"Store",UUID.randomUUID()));service=new CatalogueServiceImpl(repo,cats,wish,carts,reviews,ctx,new CommerceMapper());}
@Test void createPositiveNormalizesSku(){var c=category();when(cats.findById(1L)).thenReturn(Optional.of(c));when(repo.save(any())).thenAnswer(a->{Product p=a.getArgument(0);p.setId(1L);return p;});assertEquals("SKU-1",service.create(req("sku-1",ProductStatus.ACTIVE)).sku());}
@Test void createNegativeDuplicateSku(){when(repo.existsByRetailerIdAndSkuIgnoreCase(retailer,"SKU-1")).thenReturn(true);assertThrows(DuplicateResourceException.class,()->service.create(req("SKU-1",ProductStatus.ACTIVE)));}
@Test void createNegativeMissingCategory(){when(cats.findById(1L)).thenReturn(Optional.empty());assertThrows(ResourceNotFoundException.class,()->service.create(req("SKU-1",ProductStatus.ACTIVE)));}
@Test void updateBoundaryPreservesStock(){var p=product(10);when(repo.findByIdAndRetailerId(1L,retailer)).thenReturn(Optional.of(p));when(cats.findById(1L)).thenReturn(Optional.of(category()));when(repo.save(p)).thenReturn(p);assertEquals(10,service.update(1L,req("NEW-1",ProductStatus.ACTIVE)).stock());}
@Test void duplicatePositiveStartsDraftAndZero(){var p=product(9);when(repo.findByIdAndRetailerId(1L,retailer)).thenReturn(Optional.of(p));when(repo.save(any())).thenAnswer(a->{Product n=a.getArgument(0);n.setId(2L);return n;});var out=service.duplicate(1L);assertEquals(ProductStatus.DRAFT,out.status());assertEquals(0,out.stock());}
@Test void deleteNegativeReferencedByCart(){var p=product(1);when(repo.findByIdAndRetailerId(1L,retailer)).thenReturn(Optional.of(p));when(carts.existsByProduct_Id(1L)).thenReturn(true);assertThrows(BusinessValidationException.class,()->service.delete(1L));}
@Test void summaryBoundaryCountsThresholds(){when(repo.findByRetailerId(eq(retailer),any())).thenReturn(new PageImpl<>(List.of(product(0),product(10),product(11))));assertEquals(1,service.summary().outOfStock());}
private ProductRequest req(String sku,ProductStatus status){return new ProductRequest("Rice",sku,1L,new BigDecimal("10.00"),10,status,"Long description",null);}private ProductCategory category(){var c=new ProductCategory();c.setId(1L);c.setName("Food");return c;}private Product product(int stock){var p=new Product();p.setId(1L);p.setRetailerId(retailer);p.setSku("SKU");p.setName("Rice");p.setDescription("Long description");p.setUnitPrice(BigDecimal.TEN);p.setStatus(ProductStatus.ACTIVE);p.setStock(stock);p.setCategory(category());return p;}
}