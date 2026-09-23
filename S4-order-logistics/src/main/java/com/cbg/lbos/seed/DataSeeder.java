package com.cbg.lbos.seed;

import static com.cbg.lbos.seed.SeedSupport.LOG;
import static com.cbg.lbos.seed.SeedSupport.at;
import static com.cbg.lbos.seed.SeedSupport.await;
import static com.cbg.lbos.seed.SeedSupport.paymentReference;
import static com.cbg.lbos.seed.SeedSupport.runAsync;
import static com.cbg.lbos.seed.SeedSupport.ts;

import com.cbg.lbos.entity.LogisticsBookingDetail;
import com.cbg.lbos.entity.Order;
import com.cbg.lbos.entity.OrderItem;
import com.cbg.lbos.repository.LogisticsBookingDetailRepository;
import com.cbg.lbos.repository.OrderItemRepository;
import com.cbg.lbos.repository.OrderRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * S4 - Order &amp; Logistics: the orders the customers placed, their items, the trips that delivered them and the
 * two logistics bookings (see seed-data/ORDERS.md, LOGISTICS.md).
 *
 * The data is what the application leaves behind, replayed in the same way:
 * <ul>
 *   <li><b>One order per retailer.</b> Checkout splits a multi-retailer cart into one RETAIL order per retailer
 *       (CheckoutServiceImpl per-retailer breakdown); a checkout's orders share the placement time and a numeric
 *       suffix: ORD-&lt;epoch ms&gt;-&lt;n&gt;. Two seeded checkouts are multi-retailer.</li>
 *   <li><b>Money</b> uses the checkout formulas: line total = quantity x unit price, tax per line from S6's
 *       tax configuration of the product's category in the delivery city's state (rounded per line), delivery charge
 *       49.00 per retailer order, platform fee 2% of the subtotal, reward-point discount off the total.</li>
 *   <li><b>Status</b> follows the state machine of OrderService / TripService (NEW, WAITING_FOR_RETAILER,
 *       RETAILER_ACCEPTED, FINDING_DELIVERY_PARTNER, VEHICLE_ASSIGNED, IN_TRANSIT, DELIVERED; a trip is PLANNED then
 *       IN_PROGRESS then COMPLETED with a status-history row per step).</li>
 *   <li><b>Stock</b> is deducted from the product (S3) for every order that was not cancelled, as
 *       InventoryClient.deductStock does when an item is added.</li>
 * </ul>
 * Products come from S3, tax from S6, customers/addresses from S3, drivers and vehicles from S5, accounts from S1 -
 * all found by business key (SKU, category, email, registration number), waiting for them if needed.
 * Everything is written in one transaction, so S3 / S6 see either all orders or none.
 */
@Component
@org.springframework.core.annotation.Order(1)
public class DataSeeder implements ApplicationRunner {

    private static final BigDecimal DELIVERY_CHARGE = new BigDecimal("49.00");
    private static final BigDecimal PLATFORM_FEE_RATE = new BigDecimal("0.02");

    private static final String PICKUP_PROOF = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final LogisticsBookingDetailRepository bookingRepository;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private final boolean enabled;

    public DataSeeder(OrderRepository orderRepository, OrderItemRepository orderItemRepository,
                      LogisticsBookingDetailRepository bookingRepository, JdbcTemplate jdbc,
                      PlatformTransactionManager transactionManager, @Value("${app.seed.enabled:true}") boolean enabled) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.bookingRepository = bookingRepository;
        this.jdbc = jdbc;
        this.transaction = new TransactionTemplate(transactionManager);
        this.enabled = enabled;
    }

    /**
     * One RETAIL order.
     * key, customer, delivery-address zone, retailer, placed (days ago, hour, minute), payment method, final status,
     * lines "SKU:qty,...", trip "fleet,driver,vehicle" (1-based) or null, reward points redeemed, minutes until
     * delivery, checkout suffix (n of ORD-ms-n)
     */
    private static final Object[][] ORDERS = {
            {"O1", "customer1.chn@lbos.com", "North", "retailer1.chn@lbos.com", 30, 19, 5, "UPI", "DELIVERED", "GRO-TOORDAL-1KG:2,HHE-DISHWASH-500:1", "3,3,4", "0.00", 66, 1},
            {"O2", "customer2.baw@lbos.com", "West", "retailer2.baw@lbos.com", 40, 11, 20, "UPI", "DELIVERED", "FRV-ONION-2KG:2,GRO-ATTA-5KG:1,GRO-SUGAR-1KG:2", "1,3,4", "0.00", 71, 1},
            {"O3", "customer3.hye@lbos.com", "East", "retailer3.hye@lbos.com", 38, 17, 45, "CARD", "DELIVERED", "GRO-BASMATI-5KG:1,GRO-OIL-1L:2,BEV-TEA-500:1", "2,3,4", "0.00", 64, 1},
            {"O4", "customer2.baw@lbos.com", "West", "retailer2.baw@lbos.com", 30, 9, 50, "UPI", "DELIVERED", "BEV-COFFEE-200:1,PKG-BISCUIT-6PK:2", "1,3,4", "0.00", 58, 1},
            {"O5", "customer5.chs@lbos.com", "South", "retailer4.chs@lbos.com", 28, 18, 30, "UPI", "DELIVERED", "GRO-SAMBAR-200:2,PKG-PAPAD-200:3,BEV-BUTTERMILK-6PK:2", "3,3,4", "0.00", 69, 1},
            {"O6", "customer1.chn@lbos.com", "North", "retailer1.chn@lbos.com", 14, 19, 10, "UPI", "DELIVERED", "FRV-TOMATO-1KG:3,GRO-SONAMASURI-5:1,DAI-MILK-500:2", "3,1,1", "0.00", 72, 1},
            {"O7", "customer1.chn@lbos.com", "North", "retailer5.chn@lbos.com", 14, 19, 10, "UPI", "DELIVERED", "DAI-CURD-400:2,DAI-BREAD-400:2,BEV-JUICE-1L:1", "3,3,4", "0.00", 63, 2},
            {"O8", "customer2.baw@lbos.com", "West", "retailer2.baw@lbos.com", 20, 16, 40, "CARD", "DELIVERED", "HHE-DETERGENT-1KG:1,GRO-ATTA-5KG:1", "1,2,2", "0.00", 67, 1},
            {"O9", "customer6.baw@lbos.com", "West", "retailer2.baw@lbos.com", 18, 12, 15, "UPI", "DELIVERED", "BEV-COFFEE-200:2,PKG-BISCUIT-6PK:3", "1,3,4", "0.00", 61, 1},
            {"O10", "customer4.chn@lbos.com", "North", "retailer5.chn@lbos.com", 16, 20, 5, "CARD", "DELIVERED", "PKG-NOODLES-4PK:3,PCR-SOAP-4PK:2,ELC-LEDBULB-9W:2", "3,2,2", "0.00", 74, 1},
            {"O11", "customer1.chn@lbos.com", "West", "retailer2.baw@lbos.com", 10, 13, 25, "UPI", "DELIVERED", "HHE-DETERGENT-1KG:1,PKG-BISCUIT-6PK:1", "1,1,1", "0.00", 65, 1},
            {"O12", "customer3.hye@lbos.com", "East", "retailer3.hye@lbos.com", 9, 18, 0, "CARD", "DELIVERED", "PCR-SHAMPOO-340:1,FRV-MANGO-1KG:2,DAI-PANEER-200:1", "2,3,4", "0.00", 62, 1},
            {"O13", "customer5.chs@lbos.com", "South", "retailer4.chs@lbos.com", 7, 15, 35, "UPI", "DELIVERED", "ELC-POWERBANK-10K:1", "3,3,4", "0.00", 68, 1},
            {"O14", "customer2.baw@lbos.com", "West", "retailer2.baw@lbos.com", 6, 19, 20, "UPI", "DELIVERED", "BEV-COFFEE-200:1,FRV-ONION-2KG:3,PKG-BISCUIT-6PK:1", "1,3,4", "40.00", 60, 1},
            {"O15", "customer4.chn@lbos.com", "North", "retailer1.chn@lbos.com", 0, 17, 0, "UPI", "IN_TRANSIT", "DAI-MILK-500:3,HHE-DISHWASH-500:1", "3,1,1", "0.00", 0, 1},
            {"O16", "customer4.chn@lbos.com", "North", "retailer5.chn@lbos.com", 0, 17, 0, "UPI", "FINDING_DELIVERY_PARTNER", "BEV-JUICE-1L:2,PKG-NOODLES-4PK:2,ELC-LEDBULB-9W:1", null, "0.00", 0, 2},
            {"O17", "customer6.baw@lbos.com", "West", "retailer2.baw@lbos.com", 0, 16, 40, "CARD", "VEHICLE_ASSIGNED", "GRO-ATTA-5KG:1,GRO-SUGAR-1KG:1", "1,2,2", "0.00", 0, 1},
            {"O18", "customer5.chs@lbos.com", "South", "retailer4.chs@lbos.com", 0, 11, 30, "UPI", "RETAILER_REJECTED", "GRO-SAMBAR-200:1,GRO-TAMARIND-500:2", null, "0.00", 0, 1},
            {"O19", "customer3.hye@lbos.com", "East", "retailer3.hye@lbos.com", 1, 10, 5, "CARD", "CANCELLED", "FRV-MANGO-1KG:3", null, "0.00", 0, 1},
            {"O20", "customer7.baw@lbos.com", "West", "retailer2.baw@lbos.com", 1, 18, 5, "UPI", "DELIVERED", "PKG-BISCUIT-6PK:2,FRV-ONION-2KG:1", "1,3,4", "0.00", 250, 1},
            {"O21", "customer2.baw@lbos.com", "West", "retailer2.baw@lbos.com", 0, 16, 55, "UPI", "FINDING_DELIVERY_PARTNER", "GRO-SUGAR-1KG:2,BEV-COFFEE-200:1", null, "0.00", 0, 2},
    };

    /**
     * Logistics bookings (FLEET_SERVICE orders the customer books directly).
     * key, customer, days ago, hour, minute, method, final status, vehicle category, fleet,driver,vehicle (or null),
     * distance km, receiver, phone, email, pickup, drop, drop latitude, longitude, instructions, minutes until delivery
     */
    private static final Object[][] BOOKINGS = {
            {"L1", "customer3.hye@lbos.com", 12, 11, 0, "UPI", "DELIVERED", "BIKE", "2,3,4", "7.5", "Meghana Rao", "9848099112",
                    "meghana.rao@example.com", "Plot 14, Survey No. 32, Uppal Industrial Area, Uppal", "Flat 302, Green Meadows Apartments, Habsiguda",
                    "17.4102", "78.5445", "Documents parcel - hand over to the receiver only.", 48},
            {"L2", "customer6.baw@lbos.com", 0, 16, 0, "UPI", "BOOKING_CONFIRMED", "SMALL_TRUCK", "1,1,1", "9.2", "Aditya Hegde", "9880055006",
                    "aditya.hegde@example.com", "Godown 12, Sampige Road Industrial Area, Malleshwaram", "No. 11, 5th Cross, Vijayanagar Main Road",
                    "12.9719", "77.5343", "Household goods - handle the furniture with care, two helpers needed.", 0},
    };

    private int tripSequence = 0;

    /**
     * The seeding runs on a background thread (S4 starts without waiting for the other services) and writes all
     * orders in ONE transaction, so S3 / S6 see either all of them or none.
     */
    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            LOG.info("S4 seed skipped (app.seed.enabled=false)");
            return;
        }
        runAsync("seed-s4", () -> transaction.executeWithoutResult(status -> seedAll()));
    }

    private void seedAll() {
        Integer existingTrips = jdbc.queryForObject("select count(*) from trip", Integer.class);
        tripSequence = existingTrips == null ? 0 : existingTrips;
        int orders = 0;
        int items = 0;
        int trips = 0;
        for (Object[] o : ORDERS) {
            if (seedRetailOrder(o)) {
                orders++;
                items += ((String) o[9]).split(",").length;
                if (o[10] != null) trips++;
            }
        }
        for (Object[] b : BOOKINGS) {
            if (seedBooking(b)) {
                orders++;
                if ("DELIVERED".equals(b[6])) trips++;
            }
        }
        LOG.info("S4 seed: {} orders ({} retail items), {} trips written", orders, items, trips);
    }

    // ---- lookups -------------------------------------------------------------------------------------------

    private UUID account(String email) {
        return await(jdbc, "account " + email, UUID.class, "select user_account_id from user_account where email = ?", email);
    }

    private UUID customerProfile(String email) {
        return await(jdbc, "customer profile of " + email, UUID.class,
                "select customer_profile_id from customer_profile where user_account_id = ?", account(email));
    }

    private UUID retailerId(String email) {
        return await(jdbc, "retailer " + email, UUID.class,
                "select r.retailer_id from retailer r join user_account u on u.user_account_id = r.user_account_id where u.email = ?", email);
    }

    private record Product(long id, String name, BigDecimal price, BigDecimal weight, long categoryId, int stock) {
    }

    private Product product(String retailerEmail, String sku) {
        UUID retailer = retailerId(retailerEmail);
        await(jdbc, "product " + sku, Long.class, "select product_id from products where retailer_id = ? and sku = ?", retailer, sku);
        Map<String, Object> row = jdbc.queryForMap("select product_id, product_name, unit_price, weight_kg, category_id, stock_quantity "
                + "from products where retailer_id = ? and sku = ?", retailer, sku);
        return new Product(((Number) row.get("product_id")).longValue(), (String) row.get("product_name"), (BigDecimal) row.get("unit_price"),
                (BigDecimal) row.get("weight_kg"), ((Number) row.get("category_id")).longValue(), ((Number) row.get("stock_quantity")).intValue());
    }

    private record Address(String text, BigDecimal latitude, BigDecimal longitude, UUID stateId) {
    }

    /** The customer's address in the given zone, formatted the way checkout writes the delivery address. */
    private Address address(String customerEmail, String zone) {
        UUID profile = customerProfile(customerEmail);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select a.address_line_1, a.address_line_2, a.latitude, a.longitude, z.zone_name, c.city_name, c.state_id "
                        + "from customer_address a join zone z on z.zone_id = a.zone_id join city c on c.city_id = a.city_id "
                        + "where a.customer_profile_id = ? and z.zone_name = ?", profile, zone);
        if (rows.isEmpty()) throw new IllegalStateException("No " + zone + " address for " + customerEmail);
        Map<String, Object> a = rows.get(0);
        String text = a.get("address_line_1") + ", " + a.get("address_line_2") + ", " + a.get("zone_name") + ", " + a.get("city_name");
        return new Address(text, (BigDecimal) a.get("latitude"), (BigDecimal) a.get("longitude"), (UUID) a.get("state_id"));
    }

    /** cgst + sgst of the category's active tax configuration in the state on the given day (S6). */
    private BigDecimal taxPercent(long categoryId, UUID stateId, OffsetDateTime on) {
        return await(jdbc, "tax configuration of category " + categoryId, BigDecimal.class,
                "select cgst + sgst from tax_configuration where product_category_id = ? and state_id = ? and active = true "
                        + "and effective_from <= ? and (effective_to is null or effective_to >= ?)",
                categoryId, stateId, java.sql.Date.valueOf(on.toLocalDate()), java.sql.Date.valueOf(on.toLocalDate()));
    }

    // ---- RETAIL orders ---------------------------------------------------------------------------------------

    private boolean seedRetailOrder(Object[] o) {
        OffsetDateTime placed = at((Integer) o[4], (Integer) o[5], (Integer) o[6]);
        String orderNumber = "ORD-" + placed.toInstant().toEpochMilli() + "-" + o[13];
        if (orderRepository.existsByOrderNumber(orderNumber)) return false;

        Address address = address((String) o[1], (String) o[2]);
        String finalStatus = (String) o[8];
        UUID retailer = retailerId((String) o[3]);

        List<Product> products = new ArrayList<>();
        List<Integer> quantities = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal tax = BigDecimal.ZERO;
        for (String line : ((String) o[9]).split(",")) {
            String[] part = line.split(":");
            Product p = product((String) o[3], part[0]);
            int quantity = Integer.parseInt(part[1]);
            BigDecimal lineTotal = p.price().multiply(BigDecimal.valueOf(quantity));
            subtotal = subtotal.add(lineTotal);
            tax = tax.add(lineTotal.multiply(taxPercent(p.categoryId(), address.stateId(), placed)).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
            products.add(p);
            quantities.add(quantity);
        }
        BigDecimal platformFee = subtotal.multiply(PLATFORM_FEE_RATE).setScale(2, RoundingMode.HALF_UP);
        BigDecimal discount = new BigDecimal((String) o[11]);
        BigDecimal total = subtotal.add(tax).add(DELIVERY_CHARGE).add(platformFee).subtract(discount).max(BigDecimal.ZERO);

        // lifecycle moments (order state machine): submit +1, accepted +9, trip created +15, pickup +32, delivered
        int deliveredAfter = (Integer) o[12];
        LocalDateTime t0 = placed.toLocalDateTime();
        List<String[]> history = new ArrayList<>();
        history.add(new String[] {"NEW", t0.toString()});
        LocalDateTime last = t0;
        boolean cancelled = "CANCELLED".equals(finalStatus);
        if (!cancelled) {
            history.add(new String[] {"WAITING_FOR_RETAILER", t0.plusMinutes(1).toString()});
            last = t0.plusMinutes(1);
        }
        if ("RETAILER_REJECTED".equals(finalStatus)) {
            history.add(new String[] {"RETAILER_REJECTED", t0.plusMinutes(6).toString()});
            last = t0.plusMinutes(6);
        } else if (cancelled) {
            history.add(new String[] {"CANCELLED", t0.plusMinutes(25).toString()});
            last = t0.plusMinutes(25);
        } else {
            history.add(new String[] {"RETAILER_ACCEPTED", t0.plusMinutes(9).toString()});
            history.add(new String[] {"FINDING_DELIVERY_PARTNER", t0.plusMinutes(9).toString()});
            last = t0.plusMinutes(9);
            if (!"FINDING_DELIVERY_PARTNER".equals(finalStatus)) {
                history.add(new String[] {"VEHICLE_ASSIGNED", t0.plusMinutes(15).toString()});
                last = t0.plusMinutes(15);
            }
            if ("IN_TRANSIT".equals(finalStatus) || "DELIVERED".equals(finalStatus)) {
                history.add(new String[] {"IN_TRANSIT", t0.plusMinutes(32).toString()});
                last = t0.plusMinutes(32);
            }
            if ("DELIVERED".equals(finalStatus)) {
                history.add(new String[] {"DELIVERED", t0.plusMinutes(deliveredAfter).toString()});
                last = t0.plusMinutes(deliveredAfter);
            }
        }
        boolean paid = !cancelled;

        Order order = new Order();
        order.setOrderNumber(orderNumber);
        order.setCustomerProfileId(customerProfile((String) o[1]));
        order.setOrderType("RETAIL");
        order.setOrderDate(t0);
        order.setSubtotalAmount(subtotal);
        order.setDeliveryCharge(DELIVERY_CHARGE);
        order.setDiscountAmount(discount);
        order.setTaxAmount(tax);
        order.setPlatformFeeAmount(platformFee);
        order.setTotalAmount(total);
        order.setOrderStatus(finalStatus);
        order.setStatusHistoryJson(historyJson(history));
        order.setOrderTrackingJson("{}");
        order.setDeliveryAddress(address.text());
        order.setDeliveryLatitude(address.latitude());
        order.setDeliveryLongitude(address.longitude());
        order.setPaymentMethod((String) o[7]);
        order.setPaymentStatus(paid ? "PAID" : "PENDING");
        order.setTransactionReference(paid ? paymentReference(orderNumber) : null);
        if (cancelled) {
            order.setCancellationReason("Payment could not be completed - cancelled by the customer");
            order.setCancelledDatetime(last);
            order.setCancellationFeeAmount(BigDecimal.ZERO);
        } else if ("RETAILER_REJECTED".equals(finalStatus)) {
            order.setCancellationReason("Sorry, Sambar Powder is out of stock today");
        }
        order.setUpdatedDatetime(last);
        order = orderRepository.save(order);

        for (int i = 0; i < products.size(); i++) {
            Product p = products.get(i);
            int quantity = quantities.get(i);
            OrderItem item = new OrderItem();
            item.setOrder(order);
            item.setRetailerId(retailer);
            item.setProductId(p.id());
            item.setSkuSnapshot(((String) o[9]).split(",")[i].split(":")[0]);
            item.setProductNameSnapshot(p.name());
            item.setQuantity(quantity);
            item.setUnitPrice(p.price());
            item.setDiscountAmount(BigDecimal.ZERO);
            item.setLineTotal(p.price().multiply(BigDecimal.valueOf(quantity)));
            item.setStockRestored(cancelled);
            item.setWeightKgSnapshot(p.weight());
            orderItemRepository.save(item);
            if (!cancelled) {
                jdbc.update("update products set stock_quantity = stock_quantity - ? where product_id = ?", quantity, p.id());
            }
        }
        if (o[10] != null) {
            seedTrip(order.getId(), (String) o[10], t0, finalStatus, deliveredAfter, distanceOf(order.getId(), subtotal));
        }
        return true;
    }

    /** Deterministic, plausible delivery distance (2.5 - 11.5 km) - the same rule TripService.estimateDistanceKm applies. */
    private BigDecimal distanceOf(Long orderId, BigDecimal seed) {
        long hash = Long.hashCode(orderId * 31 + seed.longValue()) & 0x7fffffffL;
        return BigDecimal.valueOf(2.5 + (hash % 900) / 100.0).setScale(1, RoundingMode.HALF_UP);
    }

    // ---- logistics bookings (FLEET_SERVICE) ---------------------------------------------------------------------

    private boolean seedBooking(Object[] b) {
        OffsetDateTime placed = at((Integer) b[2], (Integer) b[3], (Integer) b[4]);
        String orderNumber = "LOG-" + placed.toInstant().toEpochMilli();
        if (orderRepository.existsByOrderNumber(orderNumber)) return false;

        String category = (String) b[7];
        boolean delivered = "DELIVERED".equals(b[6]);
        BigDecimal distance = new BigDecimal((String) b[9]);
        // LogisticsBookingDetailService: rate per km with a minimum distance and a minimum rate for the category
        BigDecimal rate = "BIKE".equals(category) ? new BigDecimal("10") : new BigDecimal("20");
        BigDecimal minimumDistance = "BIKE".equals(category) ? new BigDecimal("2") : new BigDecimal("5");
        BigDecimal minimumRate = "BIKE".equals(category) ? new BigDecimal("50") : new BigDecimal("150");
        BigDecimal charge = distance.max(minimumDistance).multiply(rate).max(minimumRate).setScale(2, RoundingMode.HALF_UP);

        LocalDateTime t0 = placed.toLocalDateTime();
        List<String[]> history = new ArrayList<>();
        history.add(new String[] {"NEW", t0.toString()});
        history.add(new String[] {"BOOKING_CONFIRMED", t0.plusMinutes(2).toString()});
        LocalDateTime last = t0.plusMinutes(2);
        if (delivered) {
            history.add(new String[] {"VEHICLE_ASSIGNED", t0.plusMinutes(20).toString()});
            history.add(new String[] {"IN_TRANSIT", t0.plusMinutes(32).toString()});
            last = t0.plusMinutes((Integer) b[18]);
            history.add(new String[] {"DELIVERED", last.toString()});
        }
        boolean paid = delivered;

        Order order = new Order();
        order.setOrderNumber(orderNumber);
        order.setCustomerProfileId(customerProfile((String) b[1]));
        order.setOrderType("FLEET_SERVICE");
        order.setOrderDate(t0);
        order.setSubtotalAmount(BigDecimal.ZERO);
        order.setDeliveryCharge(charge);
        order.setDiscountAmount(BigDecimal.ZERO);
        order.setTaxAmount(BigDecimal.ZERO);
        order.setPlatformFeeAmount(BigDecimal.ZERO);
        order.setTotalAmount(charge);
        order.setOrderStatus((String) b[6]);
        order.setStatusHistoryJson(historyJson(history));
        order.setOrderTrackingJson("{}");
        order.setDeliveryAddress((String) b[14]);
        order.setDeliveryLatitude(new BigDecimal((String) b[15]));
        order.setDeliveryLongitude(new BigDecimal((String) b[16]));
        order.setPaymentMethod((String) b[5]);
        order.setPaymentStatus(paid ? "PAID" : "PENDING");
        order.setTransactionReference(paid ? paymentReference(orderNumber) : null);
        order.setUpdatedDatetime(last);
        order = orderRepository.save(order);

        String[] fleetDriverVehicle = ((String) b[8]).split(",");
        UUID vehicleId = vehicleOf(Integer.parseInt(fleetDriverVehicle[0]), Integer.parseInt(fleetDriverVehicle[2]));
        LogisticsBookingDetail booking = new LogisticsBookingDetail();
        booking.setOrder(order);
        booking.setVehicleReferenceId(vehicleId);
        booking.setReceiverCustomerProfileId(customerProfile((String) b[1]));
        booking.setReceiverName((String) b[10]);
        booking.setReceiverPhoneNumber((String) b[11]);
        booking.setReceiverEmail((String) b[12]);
        booking.setBookingType(category);
        booking.setBookingLocationsJson("[{\"type\":\"PICKUP\",\"address\":\"" + b[13] + "\"},{\"type\":\"DROP\",\"address\":\"" + b[14] + "\"}]");
        booking.setSpecialInstructions((String) b[17]);
        bookingRepository.save(booking);

        if (delivered) {
            seedTrip(order.getId(), (String) b[8], t0, "DELIVERED", (Integer) b[18], distance);
        }
        return true;
    }

    // ---- trips ------------------------------------------------------------------------------------------------

    private static final String[] FLEET_OWNER_EMAILS = {"fleet1.baw@lbos.com", "fleet2.hye@lbos.com", "fleet3.chn@lbos.com"};

    private UUID fleetOwnerId(int fleet) {
        return await(jdbc, "fleet owner " + fleet, UUID.class,
                "select f.fleet_owner_id from fleet_owner f join user_account u on u.user_account_id = f.user_account_id where u.email = ?",
                FLEET_OWNER_EMAILS[fleet - 1]);
    }

    /** vehicles of a fleet, ordered as in S5's seed: 1-2 mini trucks, 3 light truck, 4 bike */
    private UUID vehicleOf(int fleet, int vehicle) {
        String[][] registrations = {
                {"KA05JK4471", "KA02MN8125", "KA04HT6093", "KA01EW3388"},
                {"TS08UB2210", "TS09FQ7754", "TS07JH1149", "TS10ER5602"},
                {"TN09BX5316", "TN02CK9942", "TN07AT6178", "TN22DM4085"}};
        return await(jdbc, "vehicle " + registrations[fleet - 1][vehicle - 1], UUID.class,
                "select vehicle_id from vehicle where registration_number = ?", registrations[fleet - 1][vehicle - 1]);
    }

    private UUID driverOf(int fleet, int driver) {
        String[] suffix = {"fleet1.baw", "fleet2.hye", "fleet3.chn"};
        return await(jdbc, "driver " + driver + " of fleet " + fleet, UUID.class,
                "select d.driver_id from driver d join user_account u on u.user_account_id = d.user_account_id where u.email = ?",
                "driver" + driver + suffix[fleet - 1] + "@lbos.com");
    }

    /**
     * TripService.create: PLANNED (history: null -> PLANNED, no actor); confirmPickup: IN_PROGRESS (pickup proof
     * required); completeDelivery: COMPLETED (delivery proof, distance). Each step is one trip_status_history row.
     */
    private void seedTrip(Long orderId, String spec, LocalDateTime t0, String orderStatus, int deliveredAfter, BigDecimal distance) {
        String[] part = spec.split(",");
        int fleet = Integer.parseInt(part[0]);
        UUID fleetOwner = fleetOwnerId(fleet);
        UUID owner = account(FLEET_OWNER_EMAILS[fleet - 1]);
        UUID tripId = UUID.randomUUID();
        boolean started = "IN_TRANSIT".equals(orderStatus) || "DELIVERED".equals(orderStatus);
        boolean completed = "DELIVERED".equals(orderStatus);
        String status = completed ? "COMPLETED" : started ? "IN_PROGRESS" : "PLANNED";
        LocalDateTime created = t0.plusMinutes(15);
        LocalDateTime planned = t0.plusMinutes(20);
        LocalDateTime started_ = t0.plusMinutes(32);
        LocalDateTime finished = t0.plusMinutes(deliveredAfter);
        String number = "TRP-" + created.toLocalDate().toString().replace("-", "") + "-" + String.format("%04d", ++tripSequence);
        jdbc.update("insert into trip(trip_id, order_id, vehicle_id, driver_id, fleet_owner_id, created_by_account_id, assigned_by_account_id, "
                        + "trip_number, trip_status, planned_start_at, actual_start_at, completed_at, distance_km, proof_of_pickup, proof_of_delivery) "
                        + "values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                tripId, orderId, vehicleOf(fleet, Integer.parseInt(part[2])), driverOf(fleet, Integer.parseInt(part[1])), fleetOwner,
                owner, owner, number, status, ts(ist(planned)), started ? ts(ist(started_)) : null, completed ? ts(ist(finished)) : null,
                distance, started ? PICKUP_PROOF : null, completed ? PICKUP_PROOF : null);
        history(tripId, null, "PLANNED", null, ist(created));
        if (started) history(tripId, "PLANNED", "IN_PROGRESS", owner, ist(started_));
        if (completed) history(tripId, "IN_PROGRESS", "COMPLETED", owner, ist(finished));
    }

    private void history(UUID tripId, String from, String to, UUID actor, OffsetDateTime at) {
        jdbc.update("insert into trip_status_history(trip_status_history_id, trip_id, from_status, to_status, changed_at, changed_by_account_id) "
                + "values (?,?,?,?,?,?)", UUID.randomUUID(), tripId, from, to, ts(at), actor);
    }

    private static OffsetDateTime ist(LocalDateTime wallClock) {
        return wallClock.atOffset(SeedSupport.IST);
    }

    private static String historyJson(List<String[]> history) {
        StringBuilder json = new StringBuilder("[");
        for (int i = 0; i < history.size(); i++) {
            if (i > 0) json.append(',');
            json.append("{\"status\":\"").append(history.get(i)[0]).append("\",\"changedAt\":\"").append(history.get(i)[1]).append("\"}");
        }
        return json.append(']').toString();
    }
}
