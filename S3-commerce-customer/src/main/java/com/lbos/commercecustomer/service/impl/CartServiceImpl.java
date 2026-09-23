package com.lbos.commercecustomer.service.impl; import com.lbos.commercecustomer.client.OrderLogisticsClient;import com.lbos.commercecustomer.dto.client.order.ServiceabilityRequest;import com.lbos.commercecustomer.dto.request.*;import com.lbos.commercecustomer.dto.response.*;import com.lbos.commercecustomer.entity.*;import com.lbos.commercecustomer.enums.ProductStatus;import com.lbos.commercecustomer.exception.*;import com.lbos.commercecustomer.repository.*;import com.lbos.commercecustomer.service.*;import java.math.BigDecimal;import java.util.*;import org.springframework.stereotype.Service;import org.springframework.transaction.annotation.*; @Service public class CartServiceImpl implements CartService {private final CustomerCartRepository carts;private final CustomerCartItemRepository items;private final ProductRepository products;private final ContextSupport ctx;private final WishlistService wishlist;private final CustomerAddressRepository addresses;private final OrderLogisticsClient order;private final FeignCallSupport feign;private final RetailerEnrichmentSupport retailers;public CartServiceImpl(CustomerCartRepository c,CustomerCartItemRepository i,ProductRepository p,ContextSupport x,WishlistService w,CustomerAddressRepository a,OrderLogisticsClient o,FeignCallSupport g,RetailerEnrichmentSupport e){carts=c;items=i;products=p;ctx=x;wishlist=w;addresses=a;order=o;feign=g;retailers=e;}
  private CartItemResponse dto(CustomerCartItem cartItem,String retailerName){var product=cartItem.getCart().getProduct();return new CartItemResponse(cartItem.getId(),product.getId(),product.getName(),cartItem.getRetailerId(),retailerName,cartItem.getQuantity(),product.getUnitPrice(),product.getUnitPrice().multiply(BigDecimal.valueOf(cartItem.getQuantity())),product.getStock(),ProductStatus.ACTIVE.equals(product.getStatus()));}
  /** Single-item convenience (add/update) - resolves its own retailer rather than requiring the caller to batch. */
  private CartItemResponse dto(CustomerCartItem cartItem){var retailer=retailers.resolveOne(cartItem.getRetailerId());return dto(cartItem,retailer==null?null:retailer.businessName());}
  private CustomerCartItem owned(UUID id){return items.findByIdAndCartCustomerId(id,ctx.customer().getId()).orElseThrow(()->new ResourceNotFoundException("Cart item not found"));}
  /** Retailer names for the whole cart are resolved once up front (not per line) - same
   * batching reasoning as ProductDiscoveryServiceImpl.search(). */
  /** Enforces the customer's active/default delivery-zone serviceability before an item is persisted.
   * This keeps wishlist->cart and every other add-to-cart entry point consistent and leaves S4
   * as the authoritative serviceability engine. */
  private void ensureProductServiceableForActiveAddress(Long productId){
    var customer=ctx.customer();
    var address=addresses.findByCustomerIdAndDefaultAddressTrue(customer.getId())
      .orElseThrow(()->new BusinessValidationException("Select an active delivery address before adding products to your cart."));
    var response=feign.call("lbos-order",()->order.serviceability(new ServiceabilityRequest(customer.getId(),address.getId(),address.getCityId(),address.getZoneId(),List.of(productId))));
    boolean serviceable=response!=null && response.serviceable() && (response.lines()==null || response.lines().stream().allMatch(line->line.serviceable()));
    if(!serviceable){
      throw new BusinessValidationException("This product cannot be delivered to your current delivery address because it is outside the serviceable zone.");
    }
  }
  @Transactional(readOnly=true) public CartResponse get(){
    var cartItems=items.findWithCartAndProductByCartCustomerId(ctx.customer().getId());
    var retailerById=retailers.resolve(cartItems.stream().map(item->item.getCart().getProduct()).toList());
    var lines=cartItems.stream().map(item->dto(item,Optional.ofNullable(retailerById.get(item.getRetailerId())).map(r->r.businessName()).orElse(null))).toList();
    return new CartResponse(lines,lines.size(),lines.stream().mapToInt(CartItemResponse::quantity).sum(),lines.stream().map(CartItemResponse::lineTotal).reduce(BigDecimal.ZERO,BigDecimal::add));
  }@Transactional public CartItemResponse add(CartItemRequest r){var customer=ctx.customer();var product=products.findById(r.productId()).orElseThrow(()->new ResourceNotFoundException("Product not found"));if(!ProductStatus.ACTIVE.equals(product.getStatus())||r.quantity()>product.getStock())throw new BusinessValidationException("Product unavailable or insufficient stock");ensureProductServiceableForActiveAddress(product.getId());var cart=carts.findByCustomerIdAndProductId(customer.getId(),product.getId()).orElseGet(()->{var newCart=new CustomerCart();newCart.setCustomer(customer);newCart.setProduct(product);return carts.save(newCart);});var item=items.findByCartId(cart.getId()).orElseGet(()->{var newItem=new CustomerCartItem();newItem.setCart(cart);newItem.setRetailerId(product.getRetailerId());return newItem;});int requestedQuantity=item.getId()==null?r.quantity():item.getQuantity()+r.quantity();if(requestedQuantity>product.getStock())throw new InsufficientStockException("Requested quantity exceeds stock");item.setQuantity(requestedQuantity);return dto(items.save(item));}@Transactional public CartItemResponse update(UUID id,CartItemRequest r){var item=owned(id);if(!item.getCart().getProduct().getId().equals(r.productId()))throw new BusinessValidationException("Product cannot be changed through quantity update");if(r.quantity()>item.getCart().getProduct().getStock())throw new InsufficientStockException("Requested quantity exceeds stock");item.setQuantity(r.quantity());return dto(items.save(item));}@Transactional public void delete(UUID id){var item=owned(id);items.delete(item);carts.delete(item.getCart());}@Transactional public void clear(){var customer=ctx.customer();items.deleteByCartCustomerId(customer.getId());carts.findByCustomerId(customer.getId()).forEach(carts::delete);}

  /**
   * Checks every cart line for (a) the underlying product still being ACTIVE and (b) quantity
   * not exceeding available stock, and returns ALL problems found rather than throwing on the
   * first bad line - callers (e.g. CheckoutServiceImpl.prepare()) decide whether/how to fail
   * closed based on the returned valid flag.
   */
  @Transactional(readOnly=true) public CartValidationResponse validate(){
    var cart=get();
    var issues=new ArrayList<CartValidationIssue>();
    for(CartItemResponse line:cart.items()){
      if(!line.productActive())issues.add(new CartValidationIssue(line.productId(),"PRODUCT_INACTIVE",line.productName()+" is no longer available. Please remove it from your cart."));
      if(line.quantity()<1||line.quantity()>line.availableStock())issues.add(new CartValidationIssue(line.productId(),"INSUFFICIENT_STOCK",line.availableStock()<=0?line.productName()+" is out of stock. Please remove it from your cart.":"Only "+line.availableStock()+" of "+line.productName()+" left, but you have "+line.quantity()+" in your cart. Please reduce the quantity."));
    }
    return new CartValidationResponse(cart,issues.isEmpty(),issues);
  }

  @Transactional public void moveToWishlist(UUID id){var item=owned(id);try{wishlist.add(new ReplaceWishlistProductRequest(item.getCart().getProduct().getId()));}catch(DuplicateResourceException ignored){}delete(id);}

  /**
   * Checks the current cart's lines against a CANDIDATE delivery address - called every time
   * the customer picks a different address in the Cart, before that address is persisted as
   * the order's delivery address. Backend is the source of truth: this reuses the same S4
   * serviceability call CheckoutServiceImpl.prepare() makes, keyed off the candidate address
   * rather than whatever the customer's stored default is.
   */
  @Transactional(readOnly=true) public CartServiceabilityResponse checkServiceability(UUID addressId){
    var customer=ctx.customer();
    var address=addresses.findByIdAndCustomerId(addressId,customer.getId()).orElseThrow(()->new ResourceNotFoundException("Address not found"));
    var productIds=get().items().stream().map(CartItemResponse::productId).toList();
    if(productIds.isEmpty())return new CartServiceabilityResponse(addressId,true,List.of());
    var sr=feign.call("lbos-order",()->order.serviceability(new ServiceabilityRequest(customer.getId(),addressId,address.getCityId(),address.getZoneId(),productIds)));
    var lines=sr==null||sr.lines()==null?List.<com.lbos.commercecustomer.dto.client.order.LineServiceabilityResult>of():sr.lines();
    boolean allServiceable=sr!=null&&sr.serviceable();
    return new CartServiceabilityResponse(addressId,allServiceable,lines);
  }
}
