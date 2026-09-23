package com.cbg.lbos.repository;

import com.cbg.lbos.entity.Order;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    boolean existsByOrderNumber(String orderNumber);

    Optional<Order> findByOrderNumber(String orderNumber);

    /**
     * Orders still waiting on a retailer response past the 10-minute acceptance window -
     * see RetailerResponseTimeoutJob.
     */
    List<Order> findByOrderStatusAndUpdatedDatetimeBefore(String orderStatus, LocalDateTime cutoff);

    /** Backs GET /api/orders/mine?customerProfileId=... (see OrderController). */
    List<Order> findByCustomerProfileId(java.util.UUID customerProfileId);

    /** Backs GET /api/orders/mine/page?customerProfileId=... - the lazy-loaded (infinite scroll)
     *  order history, newest first, one page at a time instead of every order at once. */
    org.springframework.data.domain.Page<Order> findByCustomerProfileIdOrderByOrderDateDesc(
            java.util.UUID customerProfileId, org.springframework.data.domain.Pageable pageable);

    /** Orders placed together at one checkout - see OrderTrackingGroupService. */
    List<Order> findByCustomerProfileIdAndOrderTypeAndOrderDateBetweenOrderByIdAsc(
            java.util.UUID customerProfileId, String orderType, LocalDateTime from, LocalDateTime to);

    /** Backs GET /api/orders/pending-fleet-assignment (see OrderController). */
    List<Order> findByOrderStatus(String orderStatus);

    /** Backs GET /api/orders/pending-fleet-assignment - a RETAIL order waits here at
     *  FINDING_DELIVERY_PARTNER, a FLEET_SERVICE order at BOOKING_CONFIRMED (see
     *  OrderService.getPendingFleetAssignment() and TripService.validateOrderForTrip()). */
    List<Order> findByOrderStatusIn(List<String> orderStatuses);

    /** Orders of the given retailers that are still in progress - i.e. whose status is not one of the terminal ones. */
    @org.springframework.data.jpa.repository.Query("select count(o) from Order o where o.orderStatus not in :terminalStatuses and exists "
            + "(select 1 from OrderItem i where i.order = o and i.retailerId in :retailerIds)")
    long countInProgressForRetailers(@org.springframework.data.repository.query.Param("retailerIds") java.util.Collection<java.util.UUID> retailerIds,
            @org.springframework.data.repository.query.Param("terminalStatuses") java.util.Collection<String> terminalStatuses);

    /** Orders of the given retailers delivered within [from, to). */
    @org.springframework.data.jpa.repository.Query("select count(o) from Order o where o.orderStatus = 'DELIVERED' "
            + "and o.updatedDatetime >= :from and o.updatedDatetime < :to and exists "
            + "(select 1 from OrderItem i where i.order = o and i.retailerId in :retailerIds)")
    long countDeliveredForRetailers(@org.springframework.data.repository.query.Param("retailerIds") java.util.Collection<java.util.UUID> retailerIds,
            @org.springframework.data.repository.query.Param("from") LocalDateTime from,
            @org.springframework.data.repository.query.Param("to") LocalDateTime to);
}
