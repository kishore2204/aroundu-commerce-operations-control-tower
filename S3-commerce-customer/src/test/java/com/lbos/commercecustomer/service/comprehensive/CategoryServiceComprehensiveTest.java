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
class CategoryServiceComprehensiveTest {
ProductCategoryRepository repo;ProductRepository products;CategoryServiceImpl service;
@BeforeEach void setup(){repo=mock(ProductCategoryRepository.class);products=mock(ProductRepository.class);service=new CategoryServiceImpl(repo,products,new CommerceMapper());}
@Test void createPositiveTrimsName(){when(repo.save(any())).thenAnswer(a->{ProductCategory e=a.getArgument(0);e.setId(1L);return e;});assertEquals("Food",service.create(req(" Food ")).name());}
@Test void createNegativeDuplicateIgnoringCase(){when(repo.existsByNameIgnoreCase("Food")).thenReturn(true);assertThrows(DuplicateResourceException.class,()->service.create(req("Food")));}
@Test void getPositive(){var e=category();when(repo.findById(1L)).thenReturn(Optional.of(e));assertEquals(1L,service.get(1L).id());}
@Test void getNegativeMissing(){when(repo.findById(1L)).thenReturn(Optional.empty());assertThrows(ResourceNotFoundException.class,()->service.get(1L));}
@Test void updatePositive(){var e=category();when(repo.findById(1L)).thenReturn(Optional.of(e));when(repo.save(e)).thenReturn(e);assertEquals("New",service.update(1L,req("New")).name());}
@Test void deleteNegativeReferenced(){var e=category();var p=new Product();p.setCategory(e);when(repo.findById(1L)).thenReturn(Optional.of(e));when(products.findAll()).thenReturn(List.of(p));assertThrows(BusinessValidationException.class,()->service.delete(1L));}
@Test void deletePositiveUnreferenced(){var e=category();when(repo.findById(1L)).thenReturn(Optional.of(e));when(products.findAll()).thenReturn(List.of());service.delete(1L);verify(repo).delete(e);}
@Test void searchBoundaryEmpty(){when(repo.findByNameContainingIgnoreCaseAndStatus(anyString(),any(CategoryStatus.class),any())).thenReturn(Page.empty());assertTrue(service.search("","ACTIVE",0,20).items().isEmpty());}
private CategoryRequest req(String n){return new CategoryRequest(n,"Description",CategoryStatus.ACTIVE);}private ProductCategory category(){var e=new ProductCategory();e.setId(1L);e.setName("Food");e.setStatus(CategoryStatus.ACTIVE);return e;}
}