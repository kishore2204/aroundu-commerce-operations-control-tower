package com.cbg.lbos.controller;

import com.cbg.lbos.dto.OrderItemDto;
import com.cbg.lbos.service.OrderItemService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/order-items")
public class OrderItemController {

    private final OrderItemService orderItemService;

    public OrderItemController(OrderItemService orderItemService) {
        this.orderItemService = orderItemService;
    }

    @PostMapping
    public ResponseEntity<OrderItemDto> create(@Valid @RequestBody OrderItemDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(orderItemService.create(dto));
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderItemDto> getById(@PathVariable Long id) {
        return ResponseEntity.ok(orderItemService.getById(id));
    }

    @GetMapping
    public ResponseEntity<List<OrderItemDto>> getAll() {
        return ResponseEntity.ok(orderItemService.getAll());
    }

    /** A single order's line items (product names, quantities, prices) - matched before "/{id}"
     *  by Spring MVC's more-specific-first rule. Lets a customer/retailer see what's actually
     *  in one of their own orders without the staff-only getAll(). */
    @GetMapping("/by-order/{orderId}")
    public ResponseEntity<List<OrderItemDto>> getByOrderId(@PathVariable Long orderId) {
        return ResponseEntity.ok(orderItemService.getByOrderId(orderId));
    }

    /** Line items of several orders at once: GET /api/order-items/by-orders?ids=1,2,3 (at most 100 orders). Matched
     *  before "/{id}" like "/by-order/{orderId}". */
    @GetMapping("/by-orders")
    public ResponseEntity<List<OrderItemDto>> getByOrderIds(@RequestParam List<Long> ids) {
        if (ids.size() > 100) {
            throw new IllegalArgumentException("At most 100 orders can be requested at once");
        }
        return ResponseEntity.ok(orderItemService.getByOrderIds(ids));
    }

    @PutMapping("/{id}")
    public ResponseEntity<OrderItemDto> update(
            @PathVariable Long id,
            @Valid @RequestBody OrderItemDto dto) {
        return ResponseEntity.ok(orderItemService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        orderItemService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
