package com.lbos.finance.seed;

import static com.lbos.finance.seed.SeedSupport.LOG;
import static com.lbos.finance.seed.SeedSupport.at;
import static com.lbos.finance.seed.SeedSupport.await;
import static com.lbos.finance.seed.SeedSupport.exists;
import static com.lbos.finance.seed.SeedSupport.runAsync;
import static com.lbos.finance.seed.SeedSupport.paymentReference;
import static com.lbos.finance.seed.SeedSupport.ts;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * S6 - Finance &amp; Support: tax configuration, payments, invoices, settlements, refunds, support tickets with their
 * conversations and the incident cluster, notifications and the audit trail (see seed-data/FINANCE.md, SUPPORT.md,
 * PRODUCTS_AND_TAX.md, NOTIFICATIONS_AND_AUDIT.md).
 *
 * <ul>
 *   <li>Phase 1 (immediately): the tax configuration - one ACTIVE rule per product category and state (linked to the
 *       S3 category by its id, the way TaxConfigurationServiceImpl stores it) plus one closed historic rule.</li>
 *   <li>Phase 2 (background thread, once S4's orders exist): everything that belongs to an order - the payment
 *       (PENDING -> SUCCESS/HELD on capture, RELEASED on delivery), the settlements a delivery triggers
 *       (retailer / fleet owner / platform), invoices, the tickets and refunds raised about orders, and the
 *       notifications and audit entries of the whole story.</li>
 * </ul>
 * Orders, items and trips are read from S4, categories from S3, states and accounts from S1 - by business key.
 */
@Component
@Order(1)
public class DataSeeder implements ApplicationRunner {

    private final JdbcTemplate jdbc;
    private final boolean enabled;

    public DataSeeder(JdbcTemplate jdbc, @Value("${app.seed.enabled:true}") boolean enabled) {
        this.jdbc = jdbc;
        this.enabled = enabled;
    }

    // ---- tax configuration ------------------------------------------------------------------------------------

    private static final String[] STATES = {"Tamil Nadu", "Karnataka", "Telangana"};

    /** category, CGST %, SGST % - GST is levied per product category; CGST = SGST */
    private static final String[][] TAX_RATES = {
            {"Fresh Produce", "0.00", "0.00"}, {"Groceries & Staples", "2.50", "2.50"}, {"Dairy & Bakery", "2.50", "2.50"},
            {"Beverages", "6.00", "6.00"}, {"Packaged Foods", "6.00", "6.00"}, {"Household Essentials", "9.00", "9.00"},
            {"Personal Care", "9.00", "9.00"}, {"Electronics", "9.00", "9.00"}};

    /** The seeding runs on a background thread, so S6 starts without waiting for the other services. */
    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            LOG.info("S6 seed skipped (app.seed.enabled=false)");
            return;
        }
        runAsync("seed-s6", this::seedAll);
    }

    private void seedAll() {
        for (String state : STATES) {
            for (String[] rate : TAX_RATES) seedTaxRule(state, rate[0], rate[1], rate[2], LocalDate.of(2024, 4, 1), null, true,
                    "GST for " + rate[0] + " in " + state + " (CGST " + rate[1] + "% + SGST " + rate[2] + "%)");
        }
        // the rule Beverages had before the 2024-04-01 revision - closed and inactive, kept as history
        seedTaxRule("Tamil Nadu", "Beverages", "9.00", "9.00", LocalDate.of(2022, 4, 1), LocalDate.of(2024, 3, 31), false,
                "Earlier GST rate for Beverages in Tamil Nadu (CGST 9% + SGST 9%), replaced on 2024-04-01");
        LOG.info("S6 seed: tax configuration written ({} active rules); order-dependent finance and support data follows S4's orders",
                STATES.length * TAX_RATES.length);
        seedOrderDependentData();
    }

    private void seedTaxRule(String state, String category, String cgst, String sgst, LocalDate from, LocalDate to, boolean active, String description) {
        UUID stateId = await(jdbc, "state " + state, UUID.class, "select state_id from state where state_name = ?", state);
        Long categoryId = await(jdbc, "product category " + category, Long.class, "select category_id from product_categories where category_name = ?", category);
        if (exists(jdbc, "select count(*) from tax_configuration where product_category_id = ? and state_id = ? and effective_from = ?",
                categoryId, stateId, Date.valueOf(from))) return;
        jdbc.update("insert into tax_configuration(tax_configuration_id, product_category_id, tax_category_name, description, state_id, "
                        + "cgst, sgst, effective_from, effective_to, active) values (?,?,?,?,?,?,?,?,?,?)",
                UUID.randomUUID(), categoryId, category, description, stateId, new BigDecimal(cgst), new BigDecimal(sgst),
                Date.valueOf(from), to == null ? null : Date.valueOf(to), active);
    }

    // ---- phase 2 ------------------------------------------------------------------------------------------------

    private record OrderRow(long id, String number, UUID customerProfile, String type, LocalDateTime placed, BigDecimal total,
                            BigDecimal delivery, BigDecimal tax, BigDecimal platformFee, String method, String paymentStatus,
                            String status, String reference, LocalDateTime updated) {
        OffsetDateTime placedAt() {
            return placed.atOffset(SeedSupport.IST);
        }

        OffsetDateTime updatedAt() {
            return updated.atOffset(SeedSupport.IST);
        }
    }

    private final Map<Long, UUID> paymentByOrder = new HashMap<>();
    private final Map<String, UUID> ticketByKey = new HashMap<>();

    private void seedOrderDependentData() {
        try {
            await(jdbc, "the seeded orders of S4", Integer.class, "select case when count(*) >= 23 then 1 end from orders");
            List<OrderRow> orders = jdbc.query("select order_id, order_number, customer_profile_id, order_type, order_date, total_amount, "
                            + "delivery_charge, tax_amount, platform_fee_amount, payment_method, payment_status, order_status, transaction_reference, "
                            + "updated_datetime from orders order by order_date, order_id",
                    (rs, i) -> new OrderRow(rs.getLong(1), rs.getString(2), (UUID) rs.getObject(3), rs.getString(4), rs.getTimestamp(5).toLocalDateTime(),
                            rs.getBigDecimal(6), rs.getBigDecimal(7), rs.getBigDecimal(8), rs.getBigDecimal(9), rs.getString(10), rs.getString(11),
                            rs.getString(12), rs.getString(13), rs.getTimestamp(14).toLocalDateTime()));
            for (OrderRow order : orders) seedPayment(order);
            for (OrderRow order : orders) if ("DELIVERED".equals(order.status())) seedSettlements(order);
            for (OrderRow order : orders) if ("DELIVERED".equals(order.status()) && "RETAIL".equals(order.type())) seedInvoice(order);
            seedSupport();
            for (OrderRow order : orders) seedOrderNotifications(order);
            seedAuditTrail();
            LOG.info("S6 seed: payments, settlements, invoices, support tickets, refunds, notifications and audit trail written");
        } catch (RuntimeException failure) {
            LOG.error("S6 seed: order-dependent data not written - {}", failure.getMessage(), failure);
        }
    }

    // ---- lookups ------------------------------------------------------------------------------------------------

    private UUID account(String email) {
        return await(jdbc, "account " + email, UUID.class, "select user_account_id from user_account where email = ?", email);
    }

    private UUID customerProfile(String email) {
        return await(jdbc, "customer profile of " + email, UUID.class, "select customer_profile_id from customer_profile where user_account_id = ?", account(email));
    }

    private UUID retailerId(String email) {
        return await(jdbc, "retailer " + email, UUID.class,
                "select r.retailer_id from retailer r join user_account u on u.user_account_id = r.user_account_id where u.email = ?", email);
    }

    private UUID fleetOwnerId(String email) {
        return await(jdbc, "fleet owner " + email, UUID.class,
                "select f.fleet_owner_id from fleet_owner f join user_account u on u.user_account_id = f.user_account_id where u.email = ?", email);
    }

    /** The customer's order containing a product (by SKU) that is in the given status - the earliest one. */
    private long orderOf(String customerEmail, String sku, String status) {
        boolean latest = status.endsWith("*"); // "DELIVERED*" = the most recent one
        String wanted = latest ? status.substring(0, status.length() - 1) : status;
        return await(jdbc, "order of " + customerEmail + " with " + sku + " (" + status + ")", Long.class,
                "select o.order_id from orders o join order_item oi on oi.order_id = o.order_id where o.customer_profile_id = ? "
                        + "and oi.sku_snapshot = ? and o.order_status = ? order by o.order_date " + (latest ? "desc" : "asc") + " limit 1",
                customerProfile(customerEmail), sku, wanted);
    }

    private long orderItemOf(long orderId, String sku) {
        return jdbc.queryForObject("select order_item_id from order_item where order_id = ? and sku_snapshot = ?", Long.class, orderId, sku);
    }

    // ---- payments -------------------------------------------------------------------------------------------------

    /**
     * PaymentTransactionServiceImpl: created PENDING / NOT_HELD with the order's total, captured to SUCCESS / HELD
     * (heldAt), the escrow RELEASED when the order is delivered (processedAt); a failed attempt is FAILED and does not
     * block a retry. A payment is only written for orders whose payment was captured (order.paymentStatus PAID) or failed.
     */
    private void seedPayment(OrderRow order) {
        boolean paid = "PAID".equals(order.paymentStatus());
        boolean failedOnly = "CANCELLED".equals(order.status());
        // customer4's delivered card order is the one whose first payment attempt failed and was retried
        boolean failedThenPaid = "CARD".equals(order.method()) && "DELIVERED".equals(order.status())
                && order.customerProfile().equals(customerProfile("customer4.chn@lbos.com"));
        if (!paid && !failedOnly) return;
        if (failedOnly || failedThenPaid) {
            // the first attempt failed (gateway timeout) - the customer either gave up (order cancelled) or retried
            String failedReference = paymentReference(order.number() + "-attempt-1");
            if (!exists(jdbc, "select count(*) from payment_transaction where provider_reference = ?", failedReference)) {
                jdbc.update("insert into payment_transaction(payment_transaction_id, order_id, provider_reference, payment_method, payment_status, "
                                + "escrow_status, held_at, amount, currency_code, processed_at) values (?,?,?,?,?,?,?,?,?,?)",
                        UUID.randomUUID(), order.id(), failedReference, order.method(), "FAILED", "NOT_HELD", null, order.total(), "INR",
                        ts(order.placedAt().plusMinutes(failedOnly ? 4 : 2)));
            }
        }
        if (!paid) return;
        if (exists(jdbc, "select count(*) from payment_transaction where order_id = ? and payment_status = 'SUCCESS'", order.id())) {
            paymentByOrder.put(order.id(), jdbc.queryForObject("select payment_transaction_id from payment_transaction where order_id = ? and payment_status = 'SUCCESS'", UUID.class, order.id()));
            return;
        }
        UUID id = UUID.randomUUID();
        boolean released = "DELIVERED".equals(order.status());
        jdbc.update("insert into payment_transaction(payment_transaction_id, order_id, provider_reference, payment_method, payment_status, "
                        + "escrow_status, held_at, amount, currency_code, processed_at) values (?,?,?,?,?,?,?,?,?,?)",
                id, order.id(), order.reference(), order.method(), "SUCCESS", released ? "RELEASED" : "HELD",
                ts(order.placedAt().plusMinutes(failedThenPaid ? 6 : 3)), order.total(), "INR", released ? ts(order.updatedAt()) : null);
        paymentByOrder.put(order.id(), id);
    }

    // ---- settlements -----------------------------------------------------------------------------------------------

    /**
     * SettlementServiceImpl.recordOrderDeliverySettlement: on delivery the escrow is released and the order's money is
     * split into a RETAILER payout per retailer (their line totals), a FLEET_OWNER payout (the delivery charge) and a
     * PLATFORM share (platform fee + tax). Payouts start PENDING; the older ones have been paid out (COMPLETED).
     */
    private void seedSettlements(OrderRow order) {
        UUID payment = paymentByOrder.get(order.id());
        if (payment == null || exists(jdbc, "select count(*) from settlement where payment_transaction_id = ?", payment)) return;
        List<Map<String, Object>> byRetailer = jdbc.queryForList(
                "select retailer_id, sum(line_total) as gross from order_item where order_id = ? group by retailer_id", order.id());
        for (Map<String, Object> row : byRetailer) {
            insertSettlement(order, payment, "RETAILER", (UUID) row.get("retailer_id"), (BigDecimal) row.get("gross"));
        }
        List<UUID> fleetOwners = jdbc.queryForList("select fleet_owner_id from trip where order_id = ?", UUID.class, order.id());
        if (!fleetOwners.isEmpty()) insertSettlement(order, payment, "FLEET_OWNER", fleetOwners.get(0), order.delivery());
        insertSettlement(order, payment, "PLATFORM", null, order.platformFee().add(order.tax()));
    }

    private void insertSettlement(OrderRow order, UUID payment, String payeeType, UUID payeeId, BigDecimal gross) {
        OffsetDateTime created = order.updatedAt();
        boolean paidOut = created.isBefore(SeedSupport.AS_OF.minusDays(8));
        jdbc.update("insert into settlement(settlement_id, operations_manager_id, payment_transaction_id, payee_type, payee_id, "
                        + "settlement_reference, gross_amount, fee_amount, net_amount, settlement_status, settlement_date, created_at, completed_at) "
                        + "values (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                UUID.randomUUID(), null, payment, payeeType, payeeId, payeeType + "-" + payment, gross, BigDecimal.ZERO, gross,
                paidOut ? "COMPLETED" : "PENDING", Date.valueOf(created.toLocalDate()), ts(created), paidOut ? ts(created.plusDays(3)) : null);
    }

    // ---- invoices --------------------------------------------------------------------------------------------------

    /** CustomerInvoiceServiceImpl: subtotal = the order's line totals, tax as given, total = subtotal + tax, status ISSUED. */
    private void seedInvoice(OrderRow order) {
        if (exists(jdbc, "select count(*) from customer_invoice where order_id = ?", order.id())) return;
        BigDecimal subtotal = jdbc.queryForObject("select sum(line_total) from order_item where order_id = ?", BigDecimal.class, order.id());
        jdbc.update("insert into customer_invoice(invoice_id, order_id, invoice_number, invoice_date, subtotal_amount, tax_amount, total_amount, invoice_status) "
                        + "values (?,?,?,?,?,?,?,?)",
                UUID.randomUUID(), order.id(), "INV-2026-" + String.format("%06d", order.id()), Date.valueOf(order.updatedAt().toLocalDate()),
                subtotal, order.tax(), subtotal.add(order.tax()), "ISSUED");
    }

    // ---- support tickets, conversations, refunds, cluster -----------------------------------------------------

    private static long slaHours(String priority) {
        return "LOW".equals(priority) ? 72 : "HIGH".equals(priority) ? 4 : 24;
    }

    private record Ticket(String key, String raiserEmail, String role, String customerEmail, String orderCustomer, String orderSku,
                          String orderStatus, String category, String subCategory, String priority, String status, String assignedEmail,
                          int raisedDays, int raisedHour, int raisedMinute, int resolvedDays, int resolvedHour, int resolvedMinute,
                          String subject, String description) {
    }

    private static final Ticket[] TICKETS = {
            new Ticket("T1", "customer5.chs@lbos.com", "CUSTOMER", "customer5.chs@lbos.com", "customer5.chs@lbos.com", "ELC-POWERBANK-10K", "DELIVERED",
                    "ORDER_ISSUE", "ITEM_DAMAGED", "HIGH", "CLOSED", "support1@lbos.com", 6, 9, 30, 5, 12, 0,
                    "Power bank arrived with a cracked casing",
                    "The 10000mAh power bank from my order was delivered with a visibly cracked casing and it does not charge. I have photos of the damage."),
            new Ticket("T2", "customer2.baw@lbos.com", "CUSTOMER", "customer2.baw@lbos.com", "customer2.baw@lbos.com", "PKG-BISCUIT-6PK", "DELIVERED",
                    "ORDER_ISSUE", "ITEM_MISSING", "MEDIUM", "RESOLVED", "support2@lbos.com", 29, 10, 15, 28, 15, 0,
                    "One pack of butter cookies missing from my order",
                    "I ordered two family packs of butter cookies but only one pack was in the bag. Please refund the missing pack."),
            new Ticket("T3", "customer3.hye@lbos.com", "CUSTOMER", "customer3.hye@lbos.com", "customer3.hye@lbos.com", "FRV-MANGO-1KG", "DELIVERED",
                    "ORDER_ISSUE", "ITEM_DAMAGED", "MEDIUM", "RESOLVED", "support1@lbos.com", 8, 11, 0, 7, 16, 30,
                    "Mangoes were overripe on delivery",
                    "The Banganapalli mangoes in my order were overripe and a few were already soft. Requesting a refund for them."),
            new Ticket("T4", "customer5.chs@lbos.com", "CUSTOMER", "customer5.chs@lbos.com", "customer5.chs@lbos.com", "GRO-TAMARIND-500", "RETAILER_REJECTED",
                    "ORDER_ISSUE", "ORDER_CANCELLED_BY_RETAILER", "MEDIUM", "IN_PROGRESS", "support1@lbos.com", 0, 12, 10, -1, 0, 0,
                    "Order rejected by the shop after payment",
                    "The shop rejected my order this morning but the amount I paid is still held. When will I get my money back?"),
            new Ticket("T5", "customer6.baw@lbos.com", "CUSTOMER", "customer6.baw@lbos.com", "customer6.baw@lbos.com", "GRO-ATTA-5KG", "VEHICLE_ASSIGNED",
                    "ORDER_ISSUE", "LATE_DELIVERY", "HIGH", "IN_PROGRESS", "support2@lbos.com", 0, 17, 30, -1, 0, 0,
                    "Delivery partner has not picked up my order",
                    "A vehicle was assigned nearly an hour ago but nobody has come to the shop yet. Deliveries in our area seem to be delayed."),
            new Ticket("T6", "customer2.baw@lbos.com", "CUSTOMER", "customer2.baw@lbos.com", "customer2.baw@lbos.com", "GRO-SUGAR-1KG", "FINDING_DELIVERY_PARTNER",
                    "ORDER_ISSUE", "LATE_DELIVERY", "MEDIUM", "IN_PROGRESS", "support2@lbos.com", 0, 17, 40, -1, 0, 0,
                    "Order still waiting for a delivery partner",
                    "My order has been at 'finding delivery partner' for almost an hour. Is there a problem with deliveries in West Bengaluru?"),
            new Ticket("T7", "customer7.baw@lbos.com", "CUSTOMER", "customer7.baw@lbos.com", "customer7.baw@lbos.com", "PKG-BISCUIT-6PK", "DELIVERED",
                    "ORDER_ISSUE", "LATE_DELIVERY", "MEDIUM", "IN_PROGRESS", "support1@lbos.com", 1, 22, 40, -1, 0, 0,
                    "Order arrived more than four hours late",
                    "I placed my order at 6 pm and it was delivered after 10 pm. The delivery estimate of 30-60 minutes was far off."),
            new Ticket("T8", "retailer2.baw@lbos.com", "RETAILER", null, "customer2.baw@lbos.com", "BEV-COFFEE-200", "DELIVERED*",
                    "PAYOUT_SETTLEMENT", "SETTLEMENT_DELAYED", "MEDIUM", "RESOLVED", "support1@lbos.com", 5, 10, 45, 4, 14, 20,
                    "Payout for a delivered order still pending",
                    "The payout for the coffee and onion order delivered last week is still showing as pending. Please check the settlement."),
            new Ticket("T9", "fleet1.baw@lbos.com", "FLEET_MANAGER", null, null, null, null,
                    "PAYMENT_EXPENSE", "EXPENSE_NOT_APPROVED", "LOW", "IN_PROGRESS", "support2@lbos.com", 10, 15, 0, -1, 0, 0,
                    "Repair expense submitted but not approved",
                    "The REPAIR expense we submitted for the Tata Ace three weeks ago has not been approved or rejected yet."),
            new Ticket("T10", "driver1fleet3.chn@lbos.com", "DRIVER", null, null, null, null,
                    "TRIP_ISSUE", "INCORRECT_ROUTE_INFO", "LOW", "CLOSED", "support2@lbos.com", 15, 13, 5, 14, 11, 0,
                    "Drop location pin was wrong on the trip",
                    "The navigation pin for a delivery pointed to the next street. I lost ten minutes finding the correct apartment block."),
            new Ticket("T11", "customer1.chn@lbos.com", "CUSTOMER", "customer1.chn@lbos.com", null, null, null,
                    "ACCOUNT_ISSUE", "PROFILE_UPDATE_ISSUE", "LOW", "OPEN", null, 0, 9, 0, -1, 0, 0,
                    "Cannot update the second delivery address",
                    "When I try to edit my Bengaluru work address, the save button stays disabled. Please help me update the postal code."),
    };

    /** ticket key, sender email (null = customer / raiser), role, message, minutes after the ticket was raised, internal note */
    private static final Object[][] MESSAGES = {
            {"T1", "customer5.chs@lbos.com", "CUSTOMER", "The photos of the cracked casing are attached to my order. It does not charge at all.", 5, false},
            {"T1", "support1@lbos.com", "SUPPORT_STAFF", "Sorry about that, Sneha. I have checked the delivery photo and the damage is clear. I am raising a full refund for the power bank.", 95, false},
            {"T1", "support1@lbos.com", "SUPPORT_STAFF", "Internal: item damaged in transit, retailer confirmed it was packed correctly. Refund of Rs 899.00 approved.", 120, true},
            {"T1", "customer5.chs@lbos.com", "CUSTOMER", "Thank you for the quick response.", 240, false},
            {"T2", "customer2.baw@lbos.com", "CUSTOMER", "The bag had only one of the two cookie packs, the invoice shows two.", 3, false},
            {"T2", "support2@lbos.com", "SUPPORT_STAFF", "Thanks Rahul, I have verified the order items. I will refund the missing pack.", 180, false},
            {"T2", "support2@lbos.com", "SUPPORT_STAFF", "Internal: retailer packed 1 of 2 units, refund of Rs 120.00 requested for approval.", 200, true},
            {"T3", "customer3.hye@lbos.com", "CUSTOMER", "Some of the mangoes were already soft and dark when I opened the box.", 4, false},
            {"T3", "support1@lbos.com", "SUPPORT_STAFF", "Thanks Anjali. Could you share a photo so I can review the fruit quality?", 90, false},
            {"T3", "customer3.hye@lbos.com", "CUSTOMER", "Photo shared in the order chat.", 150, false},
            {"T3", "support1@lbos.com", "SUPPORT_STAFF", "The photos show fruit within normal ripeness for the season, so a refund is not possible here. Please reach out if you notice anything else.", 1765, false},
            {"T4", "customer5.chs@lbos.com", "CUSTOMER", "The shop rejected my order but the payment is still on hold. How long will the refund take?", 4, false},
            {"T4", "support1@lbos.com", "SUPPORT_STAFF", "Hi Sneha, I can see the payment is held in escrow. I have asked the shop to confirm and I have requested the refund.", 55, false},
            {"T5", "customer6.baw@lbos.com", "CUSTOMER", "Vehicle assigned nearly an hour ago but nobody has arrived at the shop.", 3, false},
            {"T5", "support2@lbos.com", "SUPPORT_STAFF", "Internal: three late-delivery tickets from West within two hours - checking the fleet situation with the Location Manager.", 20, true},
            {"T6", "customer2.baw@lbos.com", "CUSTOMER", "Still no delivery partner for my order. It has been almost an hour.", 3, false},
            {"T7", "customer7.baw@lbos.com", "CUSTOMER", "The estimate said 30-60 minutes but the order came after four hours.", 4, false},
            {"T7", "support1@lbos.com", "SUPPORT_STAFF", "Sorry for the delay, Kavya. I am reviewing what happened and will update you shortly.", 150, false},
            {"T8", "retailer2.baw@lbos.com", "RETAILER", "The payout for the detergent order delivered last week is still pending.", 5, false},
            {"T8", "support1@lbos.com", "SUPPORT_STAFF", "Thanks Prakash. The settlement is created and scheduled for the next payout run - it will show as completed within two days.", 180, false},
            {"T9", "fleet1.baw@lbos.com", "FLEET_MANAGER", "The REPAIR expense has been pending for three weeks now.", 4, false},
            {"T9", "support2@lbos.com", "SUPPORT_STAFF", "Approvals are handled by your Operations Manager - I have escalated this to them.", 1200, false},
            {"T10", "driver1fleet3.chn@lbos.com", "DRIVER", "The drop pin was one street away from the actual apartment block.", 4, false},
            {"T10", "support2@lbos.com", "SUPPORT_STAFF", "Thanks for reporting this, Murugan. The address pin has been corrected in the customer's profile.", 300, false},
            {"T11", "customer1.chn@lbos.com", "CUSTOMER", "The save button stays disabled when I edit the Bengaluru address postal code.", 1, false},
    };

    private void seedSupport() {
        UUID retailer4 = retailerId("retailer4.chs@lbos.com");
        UUID operationsManagerAccount = account("op.ba@lbos.com");
        UUID westZone = await(jdbc, "zone Bengaluru/West", UUID.class,
                "select z.zone_id from zone z join city c on c.city_id = z.city_id where c.city_name = 'Bengaluru' and z.zone_name = 'West'");
        UUID bengaluru = await(jdbc, "city Bengaluru", UUID.class, "select city_id from city where city_name = 'Bengaluru'");
        UUID cluster = seedCluster(westZone, bengaluru);

        for (Ticket t : TICKETS) {
            String number = "TKT-2026-" + String.format("%06d", Integer.parseInt(t.key().substring(1)));
            UUID existing = jdbc.query("select customer_ticket_id from support_ticket where ticket_number = ?", rs -> rs.next() ? (UUID) rs.getObject(1) : null, number);
            if (existing != null) {
                ticketByKey.put(t.key(), existing);
                continue;
            }
            UUID id = UUID.randomUUID();
            OffsetDateTime raised = at(t.raisedDays(), t.raisedHour(), t.raisedMinute());
            boolean resolved = "RESOLVED".equals(t.status()) || "CLOSED".equals(t.status());
            OffsetDateTime resolvedAt = resolved ? at(t.resolvedDays(), t.resolvedHour(), t.resolvedMinute()) : null;
            Long orderId = t.orderSku() == null ? null : orderOf(t.orderCustomer(), t.orderSku(), t.orderStatus());
            boolean escalatedToRetailer = "T4".equals(t.key());
            boolean escalatedToRole = "T9".equals(t.key());
            boolean inCluster = "T5".equals(t.key()) || "T6".equals(t.key()) || "T7".equals(t.key());
            UUID assigned = t.assignedEmail() == null ? null : account(t.assignedEmail());
            jdbc.update("insert into support_ticket(customer_ticket_id, customer_profile_id, order_id, raised_by_account_id, raised_by_role, "
                            + "ticket_category, ticket_sub_category, assigned_support_account_id, ticket_number, subject, description, priority, "
                            + "ticket_status, escalated_to_role, escalated_to_entity_type, escalated_to_entity_id, escalated_by_account_id, "
                            + "escalation_reason, escalated_at, raised_at, resolved_at, due_by, cluster_incident_id) "
                            + "values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    id, t.customerEmail() == null ? null : customerProfile(t.customerEmail()), orderId, account(t.raiserEmail()), t.role(),
                    t.category(), t.subCategory(), assigned, number, t.subject(), t.description(), t.priority(), t.status(),
                    escalatedToRole ? "OPERATIONS_MANAGER" : null, escalatedToRetailer ? "RETAILER" : null, escalatedToRetailer ? retailer4 : null,
                    escalatedToRetailer || escalatedToRole ? assigned : null,
                    escalatedToRetailer ? "The shop must confirm the stock position and the refund timeline for this rejected order"
                            : escalatedToRole ? "Expense approvals belong to the Operations Manager of the city" : null,
                    escalatedToRetailer ? ts(at(0, 13, 0)) : escalatedToRole ? ts(at(9, 10, 30)) : null,
                    ts(raised), ts(resolvedAt), ts(raised.plusHours(slaHours(t.priority()))), inCluster ? cluster : null);
            ticketByKey.put(t.key(), id);
            if (escalatedToRetailer || escalatedToRole) {
                // the internal note escalateTicket() leaves behind
                addMessage(id, assigned, "SYSTEM", escalatedToRetailer
                        ? "Ticket escalated to the retailer for this order: The shop must confirm the stock position and the refund timeline for this rejected order"
                        : "Ticket escalated to OPERATIONS_MANAGER: Expense approvals belong to the Operations Manager of the city",
                        escalatedToRetailer ? at(0, 13, 0) : at(9, 10, 30), true);
            }
        }
        for (Object[] m : MESSAGES) {
            Ticket t = ticketOf((String) m[0]);
            UUID ticketId = ticketByKey.get(t.key());
            OffsetDateTime sent = at(t.raisedDays(), t.raisedHour(), t.raisedMinute()).plusMinutes((Integer) m[4]);
            if (exists(jdbc, "select count(*) from support_ticket_message where customer_ticket_id = ? and sent_at = ? and sender_role = ?", ticketId, ts(sent), m[2])) continue;
            addMessage(ticketId, account((String) m[1]), (String) m[2], (String) m[3], sent, (Boolean) m[5]);
        }
        seedRefunds();
        // ticket lifecycle notifications (SupportTicketServiceImpl.notify)
        for (Ticket t : TICKETS) {
            UUID ticketId = ticketByKey.get(t.key());
            OffsetDateTime raised = at(t.raisedDays(), t.raisedHour(), t.raisedMinute());
            String label = "TKT-2026-" + String.format("%06d", Integer.parseInt(t.key().substring(1)));
            if (t.assignedEmail() != null) {
                notification(account(t.assignedEmail()), "SUPPORT_STAFF", "SUPPORT_TICKET_ASSIGNED", "SUPPORT_TICKET", ticketId.toString(),
                        "Ticket assigned to you", "Ticket " + label + " (" + t.subject() + ") has been assigned to you.", raised.plusMinutes(30));
            }
            if ("RESOLVED".equals(t.status()) || "CLOSED".equals(t.status())) {
                notification(account(t.raiserEmail()), t.role(), "SUPPORT_TICKET_RESOLVED", "SUPPORT_TICKET", ticketId.toString(),
                        "Your ticket has been resolved", "Ticket " + label + " (" + t.subject() + ") has been resolved.",
                        at(t.resolvedDays(), t.resolvedHour(), t.resolvedMinute()));
            }
            if ("CLOSED".equals(t.status())) {
                notification(account(t.raiserEmail()), t.role(), "SUPPORT_TICKET_CLOSED", "SUPPORT_TICKET", ticketId.toString(),
                        "Your ticket has been closed", "Ticket " + label + " (" + t.subject() + ") has been closed.",
                        at(t.resolvedDays(), t.resolvedHour(), t.resolvedMinute()).plusDays(1));
            }
            if ("T4".equals(t.key()) || "T9".equals(t.key())) {
                notification(account(t.raiserEmail()), t.role(), "SUPPORT_TICKET_ESCALATED", "SUPPORT_TICKET", ticketId.toString(),
                        "Your ticket has been escalated", "Ticket " + label + " (" + t.subject() + ") has been escalated for further review.",
                        "T4".equals(t.key()) ? at(0, 13, 0) : at(9, 10, 30));
            }
        }
    }

    private Ticket ticketOf(String key) {
        for (Ticket t : TICKETS) if (t.key().equals(key)) return t;
        throw new IllegalStateException("Unknown ticket " + key);
    }

    private void addMessage(UUID ticketId, UUID sender, String role, String message, OffsetDateTime sent, boolean internal) {
        jdbc.update("insert into support_ticket_message(support_ticket_message_id, customer_ticket_id, sender_account_id, sender_role, message, "
                        + "internal_note, sent_at) values (?,?,?,?,?,?,?)",
                UUID.randomUUID(), ticketId, sender, role, message, internal, ts(sent));
    }

    /**
     * TicketClusterServiceImpl: three or more distinct raisers of the same category / sub-category in one zone within
     * 48 hours form an ACTIVE incident. T5, T6 and T7 (three customers of West Bengaluru, LATE_DELIVERY) are that group.
     */
    private UUID seedCluster(UUID zoneId, UUID cityId) {
        // any status: the application's own cluster scheduler resolves an incident once its 48-hour window has passed,
        // and a resolved incident must not be seeded a second time
        UUID existing = jdbc.query("select cluster_incident_id from ticket_cluster_incident where ticket_category = 'ORDER_ISSUE' "
                        + "and ticket_sub_category = 'LATE_DELIVERY' and zone_id = ?",
                rs -> rs.next() ? (UUID) rs.getObject(1) : null, zoneId);
        if (existing != null) return existing;
        UUID id = UUID.randomUUID();
        jdbc.update("insert into ticket_cluster_incident(cluster_incident_id, ticket_category, ticket_sub_category, territory_key, city_id, zone_id, "
                        + "ticket_count, distinct_raiser_count, first_seen_at, last_seen_at, detected_at, last_evaluated_at, incident_status, resolved_at) "
                        + "values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                id, "ORDER_ISSUE", "LATE_DELIVERY", "ZONE:" + zoneId, cityId, zoneId, 3, 3, ts(at(1, 22, 40)), ts(at(0, 17, 40)),
                ts(at(0, 17, 45)), ts(at(0, 17, 50)), "ACTIVE", null);
        return id;
    }

    /**
     * CustomerRefundServiceImpl: a refund is requested for one order item of a ticket's order (REQUESTED), then approved
     * and completed, or rejected with the reason appended; the category of the item is appended to the reason.
     */
    private void seedRefunds() {
        Object[][] refunds = {
                {"T1", "ELC-POWERBANK-10K", "RFD-2026-0001", "899.00", "COMPLETED", "Power bank casing cracked on delivery | Category: Electronics",
                        at(6, 10, 0), at(5, 12, 30)},
                {"T2", "PKG-BISCUIT-6PK", "RFD-2026-0002", "120.00", "APPROVED", "One butter cookie pack missing from the order | Category: Packaged Foods",
                        at(29, 11, 0), null},
                {"T3", "FRV-MANGO-1KG", "RFD-2026-0003", "240.00", "REJECTED",
                        "Mangoes overripe on delivery | Category: Fresh Produce | Rejection: Photos show the fruit within normal ripeness", at(8, 12, 0), at(7, 16, 30)},
                {"T4", "GRO-TAMARIND-500", "RFD-2026-0004", "176.00", "REQUESTED", "Order rejected by the shop after payment | Category: Groceries & Staples",
                        at(0, 12, 20), null},
        };
        for (Object[] r : refunds) {
            if (exists(jdbc, "select count(*) from customer_refund where refund_reference = ?", r[2])) continue;
            Ticket t = ticketOf((String) r[0]);
            long orderId = orderOf(t.orderCustomer(), t.orderSku(), t.orderStatus());
            UUID payment = jdbc.queryForObject("select payment_transaction_id from payment_transaction where order_id = ? and payment_status = 'SUCCESS'", UUID.class, orderId);
            jdbc.update("insert into customer_refund(customer_refund_id, customer_ticket_id, payment_transaction_id, order_item_id, refund_reference, "
                            + "refund_amount, refund_status, reason, requested_at, processed_at) values (?,?,?,?,?,?,?,?,?,?)",
                    UUID.randomUUID(), ticketByKey.get(t.key()), payment, orderItemOf(orderId, (String) r[1]), r[2], new BigDecimal((String) r[3]),
                    r[4], r[5], ts((OffsetDateTime) r[6]), ts((OffsetDateTime) r[7]));
        }
    }

    // ---- notifications ---------------------------------------------------------------------------------------------

    private void notification(UUID user, String role, String type, String referenceType, String referenceId, String title, String message, OffsetDateTime sent) {
        if (user == null) return;
        Timestamp when = ts(sent.toLocalDateTime());
        if (exists(jdbc, "select count(*) from notifications where user_account_id = ? and notification_type = ? and reference_id = ? and sent_at = ?",
                user, type, referenceId, when)) return;
        boolean read = sent.isBefore(SeedSupport.AS_OF.minusDays(2));
        jdbc.update("insert into notifications(user_account_id, role, notification_type, reference_type, reference_id, title, message, read, sent_at) "
                        + "values (?,?,?,?,?,?,?,?,?)",
                user, role, type, referenceType, referenceId, title, message, read, when);
    }

    /** The notifications OrderService / TripService / PaymentTransactionService send along an order's life. */
    private void seedOrderNotifications(OrderRow order) {
        UUID customerAccount = jdbc.queryForObject("select user_account_id from customer_profile where customer_profile_id = ?", UUID.class, order.customerProfile());
        String ref = String.valueOf(order.id());
        OffsetDateTime t0 = order.placedAt();
        boolean retail = "RETAIL".equals(order.type());
        if (!"CANCELLED".equals(order.status())) {
            notification(customerAccount, "CUSTOMER", "PAYMENT", "ORDER", ref, "Payment received",
                    "Your payment of Rs " + order.total() + " for order " + order.number() + " was received.", t0.plusMinutes(3));
        }
        if (retail) {
            UUID retailerAccount = jdbc.queryForObject("select u.user_account_id from retailer r join user_account u on u.user_account_id = r.user_account_id "
                    + "where r.retailer_id = (select retailer_id from order_item where order_id = ? limit 1)", UUID.class, order.id());
            notification(retailerAccount, "RETAILER", "ORDER_RECEIVED", "ORDER", ref, "New order received",
                    "You have a new order " + order.number() + " awaiting your response.", t0.plusMinutes(1));
            if ("RETAILER_REJECTED".equals(order.status())) {
                notification(customerAccount, "CUSTOMER", "ORDER_REJECTED", "ORDER", ref, "Order rejected", "Your order was rejected by the shop.", t0.plusMinutes(6));
            } else if ("CANCELLED".equals(order.status())) {
                notification(customerAccount, "CUSTOMER", "ORDER_CANCELLED", "ORDER", ref, "Order cancelled",
                        "Your order " + order.number() + " was cancelled: Payment could not be completed - cancelled by the customer", t0.plusMinutes(25));
            } else {
                notification(customerAccount, "CUSTOMER", "ORDER_ACCEPTED", "ORDER", ref, "Order accepted", "The shop accepted your order " + order.number() + ".", t0.plusMinutes(9));
            }
        }
        List<Map<String, Object>> trips = jdbc.queryForList("select f.user_account_id as owner, t.trip_status from trip t "
                + "join fleet_owner f on f.fleet_owner_id = t.fleet_owner_id where t.order_id = ?", order.id());
        if (!trips.isEmpty()) {
            UUID owner = (UUID) trips.get(0).get("owner");
            notification(owner, "FLEET_MANAGER", "DELIVERY_REQUEST", "ORDER", ref, "New delivery request",
                    "Order " + order.number() + " is ready for pickup and needs a delivery partner.", t0.plusMinutes(9));
            String tripStatus = (String) trips.get(0).get("trip_status");
            if ("IN_PROGRESS".equals(tripStatus) || "COMPLETED".equals(tripStatus)) {
                notification(customerAccount, "CUSTOMER", "ORDER_PICKED_UP", "ORDER", ref, "Order picked up",
                        "Your order " + order.number() + " has been picked up and is on its way.", t0.plusMinutes(32));
            }
            if ("COMPLETED".equals(tripStatus)) {
                notification(customerAccount, "CUSTOMER", "DELIVERED", "ORDER", ref, "Order delivered",
                        "Your order " + order.number() + " was delivered. Thank you for shopping with AroundU.", order.updatedAt());
            }
        }
    }

    // ---- audit trail -------------------------------------------------------------------------------------------------

    /**
     * Every audit row is written by the frontend's audit interceptor after an internal role performs a business action:
     * the action is the readable name, the module the area, newValues the technical request (status, role, "METHOD path").
     */
    private void seedAuditTrail() {
        String[][] events = {
                // actor email, role, action, module, request, days ago, hour, minute
                {"op.ch@lbos.com", "OPERATIONS_MANAGER", "Transfer Location Manager", "LOCATION MANAGERS", "PUT /api/v1/location-managers/transfer", "74", "11", "30"},
                {"lm1.chn@lbos.com", "LOCATION_MANAGER", "Approve Verification", "VERIFICATION QUEUES", "POST /api/v1/verification-queues/process-result", "71", "15", "30"},
                {"lm1.baw@lbos.com", "LOCATION_MANAGER", "Approve Verification", "VERIFICATION QUEUES", "POST /api/v1/verification-queues/process-result", "70", "15", "30"},
                {"lm1.hye@lbos.com", "LOCATION_MANAGER", "Approve Verification", "VERIFICATION QUEUES", "POST /api/v1/verification-queues/process-result", "69", "15", "30"},
                {"lm2.chn@lbos.com", "LOCATION_MANAGER", "Approve Verification", "VERIFICATION QUEUES", "POST /api/v1/verification-queues/process-result", "66", "15", "30"},
                {"lm1.chn@lbos.com", "LOCATION_MANAGER", "Approve Verification", "VERIFICATION QUEUES", "POST /api/v1/verification-queues/process-result", "64", "15", "30"},
                {"lm1.chn@lbos.com", "LOCATION_MANAGER", "Approve Verification", "VERIFICATION QUEUES", "POST /api/v1/verification-queues/process-result", "67", "16", "0"},
                {"lm1.baw@lbos.com", "LOCATION_MANAGER", "Approve Verification", "VERIFICATION QUEUES", "POST /api/v1/verification-queues/process-result", "68", "16", "0"},
                {"lm1.hye@lbos.com", "LOCATION_MANAGER", "Approve Verification", "VERIFICATION QUEUES", "POST /api/v1/verification-queues/process-result", "67", "16", "0"},
                {"admin@lbos.com", "SUPER_ADMIN", "Create Tax Configuration", "TAX CONFIGURATIONS", "POST /api/tax-configurations", "100", "11", "0"},
                {"admin@lbos.com", "SUPER_ADMIN", "Create Tax Configuration", "TAX CONFIGURATIONS", "POST /api/tax-configurations", "99", "11", "20"},
                {"admin@lbos.com", "SUPER_ADMIN", "Update Tax Configuration", "TAX CONFIGURATIONS", "PUT /api/tax-configurations", "98", "10", "10"},
                {"op.ba@lbos.com", "OPERATIONS_MANAGER", "Approve Expense", "FLEET EXPENSES", "PATCH /api/fleet-expenses/approve", "11", "12", "10"},
                {"op.hy@lbos.com", "OPERATIONS_MANAGER", "Approve Expense", "FLEET EXPENSES", "PATCH /api/fleet-expenses/approve", "13", "12", "40"},
                {"op.ch@lbos.com", "OPERATIONS_MANAGER", "Approve Expense", "FLEET EXPENSES", "PATCH /api/fleet-expenses/approve", "10", "12", "15"},
                {"op.ba@lbos.com", "OPERATIONS_MANAGER", "Reject Expense", "FLEET EXPENSES", "PATCH /api/fleet-expenses/reject", "19", "14", "5"},
                {"support1@lbos.com", "SUPPORT_STAFF", "Assign Support Ticket", "SUPPORT TICKETS", "POST /api/support-tickets/assign", "6", "10", "0"},
                {"support1@lbos.com", "SUPPORT_STAFF", "Resolve Support Ticket", "SUPPORT TICKETS", "POST /api/support-tickets/resolve", "5", "12", "0"},
                {"support1@lbos.com", "SUPPORT_STAFF", "Close Support Ticket", "SUPPORT TICKETS", "POST /api/support-tickets/close", "4", "12", "0"},
                {"support2@lbos.com", "SUPPORT_STAFF", "Assign Support Ticket", "SUPPORT TICKETS", "POST /api/support-tickets/assign", "29", "10", "45"},
                {"support2@lbos.com", "SUPPORT_STAFF", "Resolve Support Ticket", "SUPPORT TICKETS", "POST /api/support-tickets/resolve", "28", "15", "0"},
                {"support1@lbos.com", "SUPPORT_STAFF", "Assign Support Ticket", "SUPPORT TICKETS", "POST /api/support-tickets/assign", "8", "11", "30"},
                {"support1@lbos.com", "SUPPORT_STAFF", "Resolve Support Ticket", "SUPPORT TICKETS", "POST /api/support-tickets/resolve", "7", "16", "30"},
                {"support1@lbos.com", "SUPPORT_STAFF", "Assign Support Ticket", "SUPPORT TICKETS", "POST /api/support-tickets/assign", "0", "12", "40"},
                {"support1@lbos.com", "SUPPORT_STAFF", "Escalate Support Ticket", "SUPPORT TICKETS", "POST /api/support-tickets/escalate", "0", "13", "0"},
                {"support2@lbos.com", "SUPPORT_STAFF", "Assign Support Ticket", "SUPPORT TICKETS", "POST /api/support-tickets/assign", "0", "17", "35"},
                {"support2@lbos.com", "SUPPORT_STAFF", "Escalate Support Ticket", "SUPPORT TICKETS", "POST /api/support-tickets/escalate", "9", "10", "30"},
                {"admin@lbos.com", "SUPER_ADMIN", "Approve Refund", "REFUNDS", "POST /api/customer-refunds/approve", "28", "16", "0"},
                {"admin@lbos.com", "SUPER_ADMIN", "Approve Refund", "REFUNDS", "POST /api/customer-refunds/approve", "5", "12", "20"},
                {"admin@lbos.com", "SUPER_ADMIN", "Complete Refund", "REFUNDS", "POST /api/customer-refunds/complete", "5", "12", "30"},
                {"admin@lbos.com", "SUPER_ADMIN", "Reject Refund", "REFUNDS", "POST /api/customer-refunds/reject", "7", "16", "30"},
                {"admin@lbos.com", "SUPER_ADMIN", "Complete Settlement", "SETTLEMENTS", "POST /api/settlements/complete", "25", "17", "0"},
                {"admin@lbos.com", "SUPER_ADMIN", "Complete Settlement", "SETTLEMENTS", "POST /api/settlements/complete", "20", "17", "0"},
                {"admin@lbos.com", "SUPER_ADMIN", "Complete Settlement", "SETTLEMENTS", "POST /api/settlements/complete", "12", "17", "0"},
        };
        int n = 0;
        for (String[] e : events) {
            OffsetDateTime performed = at(Integer.parseInt(e[5]), Integer.parseInt(e[6]), Integer.parseInt(e[7]));
            UUID actor = account(e[0]);
            if (exists(jdbc, "select count(*) from audit_log where user_account_id = ? and action = ? and performed_at = ?", actor, e[2], ts(performed))) continue;
            jdbc.update("insert into audit_log(audit_log_id, user_account_id, action, source_module, old_values, new_values, ip_address, performed_at) "
                            + "values (?,?,?,?,?,?,?,?)",
                    UUID.randomUUID(), actor, e[2], e[3], null,
                    "{\"status\":200,\"role\":\"" + e[1] + "\",\"request\":\"" + e[4] + "\"}", "10.23.14." + (20 + (n++ % 40)), ts(performed));
        }
    }
}
