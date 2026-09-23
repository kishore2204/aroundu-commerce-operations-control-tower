package com.cbg.lbos.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Lightweight, tracking-only projection of an {@link com.cbg.lbos.entity.Order}
 * for the customer order-tracking screen.
 *
 * <p>Every field here already exists on the Order entity - this record only
 * narrows the payload so the tracking screen does not have to download pricing,
 * payment and cancellation data it never renders.
 */
public record OrderTrackingDto(
        Long orderId,
        String orderNumber,
        String orderStatus,
        String orderTrackingJson,
        LocalDateTime updatedDatetime,
        /*
         * Delivery SLA status derived from the order's Trip - see
         * OrderService.computeSlaStatus() for the full state machine. One of:
         * PENDING, IN_PROGRESS, AT_RISK, ON_TIME, LATE.
         */
        String slaStatus,
        /**
         * Human-facing label for the order's current position in the fulfilment flow - one of
         * the 9 stage labels below, or "Retailer Rejected"/"Shop Unavailable"/"Cancelled" when
         * halted off the linear path. See OrderService.buildTrackingSteps().
         */
        String displayStage,
        /**
         * Null when the order is halted (retailer-rejected/shop-unavailable/cancelled) - in that
         * case the frontend renders haltedState instead of a linear stepper.
         */
        List<TrackingStepDto> steps,
        /**
         * Non-null only when the order's fulfilment attempt has stopped short of delivery for
         * this shop: one of RETAILER_REJECTED, SHOP_UNAVAILABLE, CANCELLED. Null on the normal
         * (still-progressing-or-delivered) path.
         */
        String haltedState) {

    /**
     * One step of the customer-facing fulfilment stepper.
     *
     * @param state one of DONE, CURRENT, PENDING, FAILED
     * @param reachedAt best-effort timestamp (falls back to the order's updatedDatetime - no
     *                   per-step history is stored today, see the class-level note on OrderService)
     */
    public record TrackingStepDto(String key, String label, String state, LocalDateTime reachedAt) {
    }
}
