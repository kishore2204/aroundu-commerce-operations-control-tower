package com.lbos.commercecustomer.service.impl; import com.lbos.commercecustomer.dto.request.StockAdjustmentRequest;import com.lbos.commercecustomer.dto.response.*;import com.lbos.commercecustomer.enums.StockAdjustmentType;import com.lbos.commercecustomer.enums.InventoryStatus;import com.lbos.commercecustomer.exception.*;import com.lbos.commercecustomer.mapper.CommerceMapper;import com.lbos.commercecustomer.repository.ProductRepository;import com.lbos.commercecustomer.repository.ProductSpecifications;import com.lbos.commercecustomer.service.*;import java.util.*;import org.springframework.data.domain.*;import org.springframework.data.jpa.domain.Specification;import org.springframework.stereotype.Service;import org.springframework.transaction.annotation.*; @Service public class InventoryServiceImpl implements InventoryService {private final ProductRepository repo;private final ContextSupport ctx;private final CommerceMapper map;public InventoryServiceImpl(ProductRepository r,ContextSupport c,CommerceMapper m){repo=r;ctx=c;map=m;}private UUID retailer(){return ctx.retailer().retailerId();}

  private <E extends Enum<E>> E parseEnum(Class<E> type,String raw){if(raw==null||raw.isBlank())return null;try{return Enum.valueOf(type,raw.trim().toUpperCase());}catch(IllegalArgumentException ex){throw new BusinessValidationException("Unsupported value '"+raw+"' for "+type.getSimpleName());}}

  /** Same DB-level filter+paginate pattern as CatalogueServiceImpl.search() - see its javadoc. */
  @Transactional(readOnly=true) public PageResponse<ProductResponse> search(String q,Long cat,String inv,int p,int z){
    InventoryStatus inventoryFilter=parseEnum(InventoryStatus.class,inv);
    var spec=Specification.allOf(
        ProductSpecifications.retailerId(retailer()),
        ProductSpecifications.nameOrSkuContains(q),
        ProductSpecifications.categoryId(cat),
        ProductSpecifications.inventoryStatus(inventoryFilter));
    var productPage=repo.findAll(spec,PageRequest.of(p,z));
    return new PageResponse<>(productPage.map(map::product).getContent(),p,z,productPage.getTotalElements(),productPage.getTotalPages());
  }

  @Transactional(readOnly=true) public InventorySummaryResponse summary(){var products=repo.findByRetailerId(retailer(),Pageable.unpaged()).getContent();return new InventorySummaryResponse(products.size(),products.stream().mapToLong(product->product.getStock()).sum(),products.stream().filter(product->map.inventory(product.getStock(),product.getLowStockThreshold())==InventoryStatus.LOW_STOCK).count(),products.stream().filter(product->product.getStock()==0).count());}@Transactional public StockAdjustmentResponse adjust(StockAdjustmentRequest r){int rowsUpdated=r.type()==StockAdjustmentType.ADD_STOCK?repo.addStock(r.productId(),retailer(),r.quantity()):repo.removeStock(r.productId(),retailer(),r.quantity());if(rowsUpdated==0)throw new InsufficientStockException("Stock adjustment could not be completed");var adjustedProduct=repo.findByIdAndRetailerId(r.productId(),retailer()).orElseThrow();return new StockAdjustmentResponse(adjustedProduct.getId(),adjustedProduct.getStock(),map.inventory(adjustedProduct.getStock(),adjustedProduct.getLowStockThreshold()));}}
