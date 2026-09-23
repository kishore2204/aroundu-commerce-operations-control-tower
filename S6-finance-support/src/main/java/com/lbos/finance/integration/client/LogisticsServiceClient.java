package com.lbos.finance.integration.client;
import java.util.List;
import java.util.UUID;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;
import com.lbos.finance.integration.dto.TripResponse;
/**
 * S4 gates this behind /api/v1/internal/** with the shared HTTP Basic credential (see
 * ServiceBasicAuthFeignConfig) - the previous version of this client called
 * "/api/trips/orders/{id}", a path that never existed on S4 (TripController has no such
 * nested route; the real per-order lookup was added as an internal-only endpoint instead).
 */
@FeignClient(name = "lbos-order", contextId = "logisticsServiceClient", configuration = ServiceBasicAuthFeignConfig.class)
public interface LogisticsServiceClient {
    @GetMapping("/api/v1/internal/trips/by-order/{orderId}") TripResponse getTripByOrderId(@PathVariable("orderId") Long orderId);

    /** Consumed by the driver "my complaints" view - the distinct order ids this driver has
     *  ever been assigned, used to filter support tickets down without exposing driverId on
     *  SupportTicket itself. */
    @GetMapping("/api/v1/internal/trips/by-driver/{driverId}")
    List<Long> getOrderIdsForDriver(@PathVariable("driverId") UUID driverId);
}
