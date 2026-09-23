package com.cbg.lbos.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.cbg.lbos.dto.OrderTrackingGroupDto;
import com.cbg.lbos.service.OrderTrackingGroupService;

@RestController
@RequestMapping("/api/orders")
public class OrderTrackingGroupController {

    private final OrderTrackingGroupService trackingGroupService;

    public OrderTrackingGroupController(OrderTrackingGroupService trackingGroupService) {
        this.trackingGroupService = trackingGroupService;
    }

    /**
     * Tracking for the whole checkout this order belongs to (one entry per shop-specific order) -
     * the customer tracking screen's single poll. GET /api/orders/{id}/tracking is unchanged.
     */
    @GetMapping("/{id}/tracking-group")
    public ResponseEntity<OrderTrackingGroupDto> getTrackingGroup(@PathVariable Long id) {
        return ResponseEntity.ok(trackingGroupService.getGroup(id));
    }
}
