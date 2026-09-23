package com.cbg.lbos.dto;

import java.util.List;

/**
 * Tracking for every shop-specific order created by the same checkout, in ONE payload so the
 * customer tracking screen polls once for the whole group instead of once per shop. Each shop's
 * order keeps its own independent {@link OrderTrackingDto}; nothing here merges or replaces the
 * existing per-order tracking. A single-shop order (or a logistics booking) is simply a group of
 * one.
 */
public record OrderTrackingGroupDto(List<ShopTrackingDto> shops) {

    /**
     * @param shopName human-readable shop name - never an id; null only if the shop lookup failed
     * @param tracking the existing per-order tracking projection for this shop's order
     * @param delivery driver/vehicle details - null until a fleet owner has assigned a driver to
     *                 THIS order (i.e. until the order has a trip)
     * @param etaText customer-friendly ETA such as "Within 35 minutes" - null when not applicable
     */
    public record ShopTrackingDto(
            Long orderId,
            String orderNumber,
            String shopName,
            OrderTrackingDto tracking,
            DeliveryInfoDto delivery,
            String etaText) {
    }

    /** What a customer may see about the person delivering their order. */
    public record DeliveryInfoDto(String fleetOwnerBusinessName, String driverName, String vehicleNumber,
            String phoneNumber) {
    }
}
