package com.cbg.lbos.controller;

import com.cbg.lbos.dto.OrderDto;
import com.cbg.lbos.dto.OrderTrackingDto;
import com.cbg.lbos.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    public ResponseEntity<OrderDto> create(@Valid @RequestBody OrderDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(orderService.create(dto));
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderDto> getById(@PathVariable Long id) {
        return ResponseEntity.ok(orderService.getById(id));
    }

    /**
     * Tracking-only view for the customer order-tracking screen.
     */
    @GetMapping("/{id}/tracking")
    public ResponseEntity<OrderTrackingDto> getTracking(@PathVariable Long id) {
        return ResponseEntity.ok(orderService.getTracking(id));
    }

    /**
     * Moves a freshly-created order from NEW to WAITING_FOR_RETAILER, starting the
     * 10-minute retailer-response clock. Called once the caller has finished adding every
     * OrderItem to a just-created order (see OrderService.submit()).
     */
    @PostMapping("/{id}/submit")
    public ResponseEntity<OrderDto> submit(@PathVariable Long id) {
        return ResponseEntity.ok(orderService.submit(id));
    }

    public record CancelRequest(UUID customerProfileId, String reason) {
    }

    /** Customer-facing cancellation - see OrderService.cancel(). */
    @PostMapping("/{id}/cancel")
    public ResponseEntity<OrderDto> cancel(@PathVariable Long id, @RequestBody CancelRequest request) {
        return ResponseEntity.ok(orderService.cancel(id, request.customerProfileId(), request.reason()));
    }

    /**
     * Exactly one of customerProfileId/retailerId must be given - a customer listing their own
     * orders, or a retailer listing orders containing their own products. See
     * OrderService.getMineForCustomer()/getMineForRetailer().
     */
    @GetMapping("/mine")
    public ResponseEntity<List<OrderDto>> mine(
            @RequestParam(required = false) UUID customerProfileId,
            @RequestParam(required = false) UUID retailerId) {
        if (customerProfileId != null) {
            return ResponseEntity.ok(orderService.getMineForCustomer(customerProfileId));
        }
        if (retailerId != null) {
            return ResponseEntity.ok(orderService.getMineForRetailer(retailerId));
        }
        throw new IllegalArgumentException("Either customerProfileId or retailerId is required");
    }

    /**
     * The lazy-loaded (infinite scroll) version of GET /mine for a customer - one page of their
     * own order history at a time, newest first, instead of every order at once. See
     * OrderService.getMineForCustomerPaged(); OrderListComponent calls this as the customer
     * scrolls, /mine itself is unchanged for its other callers (retailer/fleet-owner screens).
     */
    @GetMapping("/mine/page")
    public ResponseEntity<org.springframework.data.domain.Page<OrderDto>> minePaged(
            @RequestParam UUID customerProfileId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(orderService.getMineForCustomerPaged(
                customerProfileId, org.springframework.data.domain.PageRequest.of(page, size)));
    }

    @GetMapping("/pending-fleet-assignment")
    public ResponseEntity<List<OrderDto>> pendingFleetAssignment() {
        return ResponseEntity.ok(orderService.getPendingFleetAssignment());
    }

    @GetMapping
    public ResponseEntity<List<OrderDto>> getAll() {
        return ResponseEntity.ok(orderService.getAll());
    }

    @PutMapping("/{id}")
    public ResponseEntity<OrderDto> update(
            @PathVariable Long id,
            @Valid @RequestBody OrderDto dto) {
        return ResponseEntity.ok(orderService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        orderService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
