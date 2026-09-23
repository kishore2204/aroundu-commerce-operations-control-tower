package com.cbg.lbos.controller;

import com.cbg.lbos.dto.OrderDto;
import com.cbg.lbos.dto.RetailerRejectRequest;
import com.cbg.lbos.service.OrderService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Retailer-facing accept/reject actions on an order. Routed under the existing
 * /api/orders/** prefix, which the Gateway's ORDER_PARTICIPANTS rule already allows
 * RETAILER to call - no Gateway change needed for this controller.
 *
 * The acting retailer is resolved from the caller's own JWT subject (see
 * OrderService.resolveActingRetailerId()), never from a client-supplied id, so ownership
 * can't be spoofed by passing someone else's retailerId.
 */
@RestController
@RequestMapping("/api/orders")
public class RetailerOrderActionController {

    private final OrderService orderService;

    public RetailerOrderActionController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping("/{id}/retailer-accept")
    public ResponseEntity<OrderDto> accept(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(orderService.retailerAccept(id, actingUserAccountId(authentication)));
    }

    @PostMapping("/{id}/retailer-reject")
    public ResponseEntity<OrderDto> reject(
            @PathVariable Long id,
            @RequestBody(required = false) RetailerRejectRequest request,
            Authentication authentication) {
        String reason = request == null ? null : request.reason();
        return ResponseEntity.ok(orderService.retailerReject(id, actingUserAccountId(authentication), reason));
    }

    private UUID actingUserAccountId(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }
}
