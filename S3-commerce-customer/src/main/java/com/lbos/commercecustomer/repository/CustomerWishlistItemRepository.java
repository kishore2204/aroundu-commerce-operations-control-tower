package com.lbos.commercecustomer.repository; import com.lbos.commercecustomer.entity.*;import java.util.*;import org.springframework.data.domain.*;import org.springframework.data.jpa.repository.*;import org.springframework.data.repository.query.Param; public interface CustomerWishlistItemRepository extends JpaRepository<CustomerWishlistItem,UUID> {Page<CustomerWishlistItem> findByCustomerId(UUID id,Pageable p); Optional<CustomerWishlistItem> findByIdAndCustomerId(UUID id,UUID customerId); boolean existsByCustomerIdAndProductId(UUID c,Long p); long countByCustomerId(UUID c); boolean existsByProduct_Id(Long productId);
  /*
   * Plain derived-query naming (findProductIdByCustomerIdAndProductIdIn) 500'd at runtime -
   * "ProductId" as a projection subject doesn't cleanly resolve against the `product`
   * relation the way "CustomerId"/"ProductId" resolve in a WHERE-clause predicate. An explicit
   * @Query sidesteps the ambiguity entirely - same one-query batch-membership intent (still a
   * single IN query, not N existsBy calls).
   */
  @Query("select w.product.id from CustomerWishlistItem w where w.customer.id=:customerId and w.product.id in :productIds")
  List<Long> findProductIdsByCustomerIdAndProductIdIn(@Param("customerId") UUID customerId,@Param("productIds") Collection<Long> productIds);}