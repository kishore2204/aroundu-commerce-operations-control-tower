package com.cbg.lbos.scheduler;

import com.cbg.lbos.client.CustomerClient;
import com.cbg.lbos.client.NotificationClient;
import com.cbg.lbos.client.dto.CustomerSummary;
import com.cbg.lbos.client.dto.NotificationCreateRequest;
import com.cbg.lbos.entity.Order;
import com.cbg.lbos.repository.OrderRepository;
import feign.FeignException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Enforces the 10-minute retailer-acceptance window: an order left in WAITING_FOR_RETAILER
 * past that window is flipped to SHOP_UNAVAILABLE and the customer is notified to find
 * another shop. This is the first {@code @Scheduled} job in the monorepo (confirmed by
 * grepping every service before adding this) - see LbosApplication's {@code @EnableScheduling}.
 *
 * {@code fixedDelay} (not {@code fixedRate}) so a slow notification Feign call can't cause
 * overlapping runs to stack up. A 60-second poll granularity against a 10-minute SLA is
 * comfortably precise (worst case: an order times out a few dozen seconds late) without
 * meaningful database load - no distributed lock/Quartz is warranted for this single-instance
 * H2 training/demo deployment; a multi-instance deployment would double-notify, which is an
 * accepted limitation at this project's stated scope.
 */
@Component
public class RetailerResponseTimeoutJob {

    private static final Logger log = LoggerFactory.getLogger(RetailerResponseTimeoutJob.class);
    private static final int RETAILER_RESPONSE_WINDOW_MINUTES = 10;

    private final OrderRepository orderRepository;
    private final CustomerClient customerClient;
    private final NotificationClient notificationClient;

    public RetailerResponseTimeoutJob(
            OrderRepository orderRepository,
            CustomerClient customerClient,
            NotificationClient notificationClient) {
        this.orderRepository = orderRepository;
        this.customerClient = customerClient;
        this.notificationClient = notificationClient;
    }

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void expireUnansweredOrders() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(RETAILER_RESPONSE_WINDOW_MINUTES);
        List<Order> stale = orderRepository.findByOrderStatusAndUpdatedDatetimeBefore(
                "WAITING_FOR_RETAILER", cutoff);

        for (Order order : stale) {
            order.setOrderStatus("SHOP_UNAVAILABLE");
            order.setUpdatedDatetime(LocalDateTime.now());
            orderRepository.save(order);
            notifyCustomerBestEffort(order);
        }
    }

    private void notifyCustomerBestEffort(Order order) {
        try {
            CustomerSummary customer = customerClient.getCustomer(order.getCustomerProfileId());
            notificationClient.create(new NotificationCreateRequest(
                    customer.userAccountId(), "CUSTOMER", "SHOP_UNAVAILABLE",
                    "ORDER", String.valueOf(order.getId()), "Shop unavailable",
                    "The shop did not respond to your order. Please find another shop for this product."));
        } catch (FeignException exception) {
            log.warn("Failed to notify customer about timed-out order {}: {}",
                    order.getId(), exception.getMessage());
        }
    }
}
