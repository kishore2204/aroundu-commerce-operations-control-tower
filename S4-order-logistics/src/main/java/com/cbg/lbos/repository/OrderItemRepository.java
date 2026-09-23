package com.cbg.lbos.repository;

import com.cbg.lbos.entity.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {
    boolean existsByOrder_IdAndProductId(Long orderId, Long productId);

    List<OrderItem> findByOrder_Id(Long orderId);

    /** Lines of several orders in ONE query - used to total order weights without a query per order. */
    List<OrderItem> findByOrder_IdIn(java.util.Collection<Long> orderIds);

    /** Distinct order ids containing at least one line item for this retailer - see
     * OrderService.getMineForRetailer(), backing the retailer's "incoming orders" screen. */
    @Query("select distinct oi.order.id from OrderItem oi where oi.retailerId = :retailerId")
    List<Long> findDistinctOrderIdsByRetailerId(@Param("retailerId") UUID retailerId);

    /** Every DELIVERED order id this customer has that contains this product - backs "has this
     *  customer ever purchased/received this product" for review eligibility, without the
     *  caller (S3) needing to already know an orderId. Most recent first so the caller can just
     *  take the first result. */
    @Query("select oi.order.id from OrderItem oi where oi.order.customerProfileId = :customerProfileId "
            + "and oi.productId = :productId and oi.order.orderStatus = 'DELIVERED' order by oi.order.orderDate desc")
    List<Long> findDeliveredOrderIdsForCustomerAndProduct(@Param("customerProfileId") UUID customerProfileId, @Param("productId") Long productId);
}
