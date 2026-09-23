package com.cbg.lbos.service;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.cbg.lbos.entity.OrderItem;
import com.cbg.lbos.repository.OrderItemRepository;

/**
 * The one place an order's weight is calculated:
 *
 * <pre>total order weight = SUM( unit weight (kg) x ordered quantity )   over the order's own items</pre>
 *
 * Each order is measured on its own (a checkout that spans several shops has one order per shop and
 * they are never combined). An item with no recorded unit weight counts as 1 kg - see
 * {@link OrderItem#effectiveWeightKg()}. Internal, fleet-side information: nothing here is exposed on
 * customer-facing responses.
 */
@Service
public class OrderWeightService {

    private final OrderItemRepository orderItemRepository;

    public OrderWeightService(OrderItemRepository orderItemRepository) {
        this.orderItemRepository = orderItemRepository;
    }

    /** Total weight of one order in kg, or null when the order has no items (e.g. a logistics booking). */
    public BigDecimal totalWeightKg(Long orderId) {
        List<OrderItem> items = orderItemRepository.findByOrder_Id(orderId);
        return items.isEmpty() ? null : sum(items);
    }

    /** Total weight per order for many orders with ONE item query; orders without items are absent. */
    public Map<Long, BigDecimal> totalWeightKgByOrderId(Collection<Long> orderIds) {
        Map<Long, BigDecimal> totals = new HashMap<>();
        if (orderIds == null || orderIds.isEmpty()) {
            return totals;
        }
        for (OrderItem item : orderItemRepository.findByOrder_IdIn(orderIds)) {
            totals.merge(item.getOrder().getId(), lineWeight(item), BigDecimal::add);
        }
        return totals;
    }

    private static BigDecimal sum(List<OrderItem> items) {
        return items.stream().map(OrderWeightService::lineWeight).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal lineWeight(OrderItem item) {
        int quantity = item.getQuantity() == null ? 0 : item.getQuantity();
        return item.effectiveWeightKg().multiply(BigDecimal.valueOf(quantity));
    }

    /** "85", "2.5" - kilograms without trailing zeros, for messages. */
    public static String format(BigDecimal kg) {
        return kg.stripTrailingZeros().toPlainString();
    }
}
