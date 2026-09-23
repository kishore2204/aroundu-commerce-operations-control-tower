package com.cbg.lbos.dto;

import java.util.List;

/**
 * Summary returned to S2 after a partner suspension has been applied to this service's
 * in-flight orders.
 *
 * @param cancelledOrderCount how many non-terminal orders were transitioned to CANCELLED
 * @param cancelledOrderIds the ids of those orders, so the caller can log/audit exactly which
 *                          orders the suspension took down
 */
public record PartnerSuspensionCancellationResponse(
        int cancelledOrderCount,
        List<Long> cancelledOrderIds) {
}
