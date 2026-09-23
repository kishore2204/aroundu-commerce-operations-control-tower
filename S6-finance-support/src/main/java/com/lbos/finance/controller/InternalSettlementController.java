package com.lbos.finance.controller;

import java.util.List;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.lbos.finance.entity.Settlement;
import com.lbos.finance.service.SettlementService;

/**
 * Called from S4's TripService once a trip/order reaches DELIVERED - splits the order's
 * payment into per-retailer, fleet-owner, and platform settlement rows. Gated by
 * hasRole("SERVICE") like the other /api/v1/internal/** endpoints.
 */
@RestController
@RequestMapping("/api/v1/internal/settlements")
public class InternalSettlementController {

    private final SettlementService settlementService;

    public InternalSettlementController(SettlementService settlementService) {
        this.settlementService = settlementService;
    }

    @PostMapping("/order-delivered/{orderId}")
    public List<Settlement> orderDelivered(@PathVariable("orderId") Long orderId) {
        return settlementService.recordOrderDeliverySettlement(orderId);
    }
}
