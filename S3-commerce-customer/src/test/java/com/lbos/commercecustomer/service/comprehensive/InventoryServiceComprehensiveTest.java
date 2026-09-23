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
class InventoryServiceComprehensiveTest {
ProductRepository repo;ContextSupport ctx;InventoryServiceImpl service;UUID retailer;
@BeforeEach void setup(){repo=mock(ProductRepository.class);ctx=mock(ContextSupport.class);retailer=UUID.randomUUID();when(ctx.retailer()).thenReturn(new RetailerContextResponse(retailer,UUID.randomUUID(),"Store",UUID.randomUUID()));service=new InventoryServiceImpl(repo,ctx,new CommerceMapper());}
@Test void addPositive(){when(repo.addStock(1L,retailer,5)).thenReturn(1);when(repo.findByIdAndRetailerId(1L,retailer)).thenReturn(Optional.of(product(15)));assertEquals(15,service.adjust(new StockAdjustmentRequest(1L,StockAdjustmentType.ADD_STOCK,5)).resultingQuantity());}
@Test void removePositive(){when(repo.removeStock(1L,retailer,5)).thenReturn(1);when(repo.findByIdAndRetailerId(1L,retailer)).thenReturn(Optional.of(product(5)));assertEquals(5,service.adjust(new StockAdjustmentRequest(1L,StockAdjustmentType.REMOVE_STOCK,5)).resultingQuantity());}
@Test void removeNegativeInsufficient(){when(repo.removeStock(1L,retailer,6)).thenReturn(0);assertThrows(InsufficientStockException.class,()->service.adjust(new StockAdjustmentRequest(1L,StockAdjustmentType.REMOVE_STOCK,6)));}
@Test void boundaryZeroOutOfStock(){assertEquals(InventoryStatus.OUT_OF_STOCK,new CommerceMapper().inventory(0,null));}
@Test void boundaryOneLowStock(){assertEquals(InventoryStatus.LOW_STOCK,new CommerceMapper().inventory(1,null));}
@Test void boundaryTenLowStock(){assertEquals(InventoryStatus.LOW_STOCK,new CommerceMapper().inventory(10,null));}
@Test void boundaryElevenHealthy(){assertEquals(InventoryStatus.HEALTHY,new CommerceMapper().inventory(11,null));}
@Test void customThresholdLowStock(){assertEquals(InventoryStatus.LOW_STOCK,new CommerceMapper().inventory(15,20));}
@Test void customThresholdHealthy(){assertEquals(InventoryStatus.HEALTHY,new CommerceMapper().inventory(15,10));}
@Test void summaryBoundaryNoProducts(){when(repo.findByRetailerId(eq(retailer),any())).thenReturn(Page.empty());var s=service.summary();assertEquals(0,s.totalProducts());assertEquals(0,s.totalStock());}
private Product product(int q){var p=new Product();p.setId(1L);p.setStock(q);return p;}
}