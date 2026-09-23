package com.lbos.commercecustomer.service.impl; import com.lbos.commercecustomer.dto.response.*;import com.lbos.commercecustomer.enums.ProductStatus;import com.lbos.commercecustomer.exception.ResourceNotFoundException;import com.lbos.commercecustomer.mapper.CommerceMapper;import com.lbos.commercecustomer.repository.ProductRepository;import com.lbos.commercecustomer.repository.ProductSpecifications;import com.lbos.commercecustomer.service.ProductDiscoveryService;import java.util.*;import org.springframework.data.domain.*;import org.springframework.data.jpa.domain.Specification;import org.springframework.stereotype.Service;import org.springframework.transaction.annotation.*; @Service public class ProductDiscoveryServiceImpl implements ProductDiscoveryService {private final ProductRepository repo;private final CommerceMapper map;private final RetailerEnrichmentSupport retailers;public ProductDiscoveryServiceImpl(ProductRepository r,CommerceMapper m,RetailerEnrichmentSupport e){repo=r;map=m;retailers=e;}

  /**
   * status=ACTIVE plus every optional filter (q, categoryId, retailerId, inStock) is applied as
   * a DB-level WHERE clause via ProductSpecifications, then paginated - replacing the previous
   * repo.findAll(PageRequest) + in-memory .filter() chain, which paginated the *unfiltered*
   * table first (wrong totalElements/totalPages) and could hide matches outside the current
   * unfiltered page. Retailer summaries for the page's distinct retailer ids are resolved once
   * up front (not per product) so every product card can show its shop without an N+1 Feign
   * call per row - see requirement that a product must never be shown without its shop.
   *
   * Deliberately NOT @Transactional: the S2 lookups above and below are HTTP calls, and a
   * method-level transaction would hold a pooled DB connection for their whole duration. The
   * query itself runs in the repository's own read-only transaction and fetches the category
   * eagerly (fetchCategory), so nothing is lazily loaded afterwards.
   */
  public PageResponse<ProductResponse> search(String q,Long cat,UUID retailer,Boolean stock,UUID zoneId,int p,int z){
    var zoneRetailerIds = zoneId == null ? null : retailers.retailerIdsForZone(zoneId);
    var openRetailerIds = retailers.openRetailerIds();
    var spec=Specification.allOf(
        ProductSpecifications.status(ProductStatus.ACTIVE),
        ProductSpecifications.nameOrSkuOrDescriptionContains(q),
        ProductSpecifications.categoryId(cat),
        ProductSpecifications.retailerId(retailer),
        ProductSpecifications.retailerIdIn(zoneRetailerIds),
        ProductSpecifications.retailerIdIn(openRetailerIds),
        ProductSpecifications.inStock(stock),
        ProductSpecifications.fetchCategory());
    var productPage=repo.findAll(spec,PageRequest.of(p,z));
    var retailerById=retailers.resolve(productPage.getContent());
    var content=productPage.getContent().stream().map(product->map.product(product,retailerById.get(product.getRetailerId()))).toList();
    return new PageResponse<>(content,p,z,productPage.getTotalElements(),productPage.getTotalPages());
  }

  @Transactional(readOnly=true) public ProductResponse get(Long id){
    var product=repo.findById(id)
        .filter(candidate->ProductStatus.ACTIVE.equals(candidate.getStatus()))
        .orElseThrow(()->new ResourceNotFoundException("Product not found"));
    var openRetailerIds=retailers.openRetailerIds();
    if(openRetailerIds==null || !openRetailerIds.contains(product.getRetailerId())){
      throw new ResourceNotFoundException("Product is not available while the store is closed");
    }
    return map.product(product,retailers.resolveOne(product.getRetailerId()));
  }

  /**
   * Batched form of get(id) - same ACTIVE-status and shop-must-be-open filtering, applied to a
   * whole list of ids in ONE query instead of one get(id) call per id. Added for S4's checkout
   * serviceability check, which previously called GET /products/{id} once per cart line - a
   * live network trace measured a 2-line cart's /checkout/prepare at ~340ms, most of it these
   * sequential per-product Feign round trips. An id that does not qualify (not found, inactive,
   * or its shop currently closed) is simply omitted from the result, exactly like it would have
   * produced a 404 (caught as COMMERCE_SERVICE_UNAVAILABLE) from the old per-id call - the set of
   * ids present in the response is all a caller needs to tell "servable" from "not servable".
   */
  @Transactional(readOnly=true) public List<ProductResponse> getByIds(List<Long> ids){
    if(ids==null || ids.isEmpty()) return List.of();
    var spec=Specification.allOf(
        ProductSpecifications.idIn(ids),
        ProductSpecifications.status(ProductStatus.ACTIVE),
        ProductSpecifications.fetchCategory());
    var products=repo.findAll(spec);
    var openRetailerIds=retailers.openRetailerIds();
    var servable=products.stream().filter(p->openRetailerIds!=null && openRetailerIds.contains(p.getRetailerId())).toList();
    var retailerById=retailers.resolve(servable);
    return servable.stream().map(product->map.product(product,retailerById.get(product.getRetailerId()))).toList();
  }}
