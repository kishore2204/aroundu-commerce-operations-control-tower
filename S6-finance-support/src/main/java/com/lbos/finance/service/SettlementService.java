package com.lbos.finance.service;
import java.util.List;
import java.util.UUID;
import com.lbos.finance.dto.SettlementRequest;
import com.lbos.finance.dto.SettlementUpdateRequest;
import com.lbos.finance.entity.Settlement;
public interface SettlementService {
    Settlement createSettlement(SettlementRequest request);
    List<Settlement> getAllSettlements();
    Settlement getSettlementById(UUID id);
    Settlement updateSettlement(UUID id, SettlementUpdateRequest request);
    Settlement completeSettlement(UUID id);

    /** Only a still-PENDING settlement may be cancelled/deleted. */
    void deleteSettlement(UUID id);

    /**
     * Splits a delivered order's payment into up to N settlement rows: one per distinct
     * retailer in the order, one for the fleet owner (if a trip exists), and one for the
     * platform's fee+tax. Called once per order (from S4, via the internal endpoint) when a
     * trip reaches COMPLETED / the order reaches DELIVERED - idempotent, so a retried/duplicated
     * call is a safe no-op.
     */
    List<Settlement> recordOrderDeliverySettlement(Long orderId);
}
