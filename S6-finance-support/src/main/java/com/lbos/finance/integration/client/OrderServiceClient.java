package com.lbos.finance.integration.client;
import java.util.List;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;
import com.lbos.finance.integration.dto.*;
/**
 * S4 gates these behind /api/v1/internal/** with the shared HTTP Basic credential (see
 * ServiceBasicAuthFeignConfig) - the previous version of this client called the public,
 * unauthenticated "/api/orders/{id}" (a path that does exist, but requires a JWT now that S4
 * has real auth) and "/api/orders/{id}/items" (a path that never existed at all).
 */
@FeignClient(name = "lbos-order", configuration = ServiceBasicAuthFeignConfig.class)
public interface OrderServiceClient {
    @GetMapping("/api/v1/internal/orders/{orderId}") OrderResponse getOrderById(@PathVariable("orderId") Long orderId);
    @GetMapping("/api/v1/internal/orders/{orderId}/items") List<OrderItemResponse> getOrderItems(@PathVariable("orderId") Long orderId);

    /**
     * Called from PaymentTransactionServiceImpl.capture() once a simulated payment succeeds -
     * closes the gap that class's own comment previously documented ("nothing in S4 calls back
     * into S6 to flip an order's paymentStatus once a payment is captured here"). Sets only
     * Order.paymentStatus=PAID on S4's side - does not touch orderStatus, which is a separate
     * axis driven by the retailer-accept/reject/fulfilment flow.
     */
    @org.springframework.web.bind.annotation.PostMapping("/api/v1/internal/orders/{orderId}/payment-confirmed")
    void confirmPayment(@PathVariable("orderId") Long orderId);
}
