package com.cbg.lbos.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.cbg.lbos.entity.Order;
import com.cbg.lbos.entity.OrderItem;
import com.cbg.lbos.repository.OrderItemRepository;

@ExtendWith(MockitoExtension.class)
class OrderWeightServiceTest {

    @Mock private OrderItemRepository orderItemRepository;
    @InjectMocks private OrderWeightService service;

    private static OrderItem item(Long orderId, String unitWeightKg, int quantity) {
        Order order = new Order();
        order.setId(orderId);
        OrderItem item = new OrderItem();
        item.setOrder(order);
        item.setQuantity(quantity);
        item.setWeightKgSnapshot(unitWeightKg == null ? null : new BigDecimal(unitWeightKg));
        return item;
    }

    @Test
    void totalWeightIsUnitWeightTimesQuantitySummedOverEveryItem() {
        // 2 kg x 3 + 5 kg x 2 = 16 kg
        when(orderItemRepository.findByOrder_Id(1L)).thenReturn(List.of(item(1L, "2", 3), item(1L, "5", 2)));
        assertEquals(0, new BigDecimal("16").compareTo(service.totalWeightKg(1L)));

        // 1.5 x 2 + 3 x 1 + 0.5 x 4 = 8 kg
        when(orderItemRepository.findByOrder_Id(2L))
                .thenReturn(List.of(item(2L, "1.5", 2), item(2L, "3", 1), item(2L, "0.5", 4)));
        assertEquals(0, new BigDecimal("8").compareTo(service.totalWeightKg(2L)));
    }

    @Test
    void anItemWithNoRecordedWeightCountsAsOneKgPerUnit() {
        when(orderItemRepository.findByOrder_Id(1L)).thenReturn(List.of(item(1L, null, 4), item(1L, "2", 1)));
        assertEquals(0, new BigDecimal("6").compareTo(service.totalWeightKg(1L)));
    }

    @Test
    void anOrderWithoutItemsHasNoWeight() {
        when(orderItemRepository.findByOrder_Id(9L)).thenReturn(List.of());
        assertNull(service.totalWeightKg(9L));
    }

    @Test
    void weightsForManyOrdersComeFromOneQueryAndStayPerOrder() {
        when(orderItemRepository.findByOrder_IdIn(List.of(1L, 2L)))
                .thenReturn(List.of(item(1L, "2", 3), item(2L, "5", 2), item(1L, "1", 1)));

        Map<Long, BigDecimal> totals = service.totalWeightKgByOrderId(List.of(1L, 2L));

        assertEquals(0, new BigDecimal("7").compareTo(totals.get(1L)));
        assertEquals(0, new BigDecimal("10").compareTo(totals.get(2L)));
    }
}
