# Finance (S6)

> Generated from the seeded database by `seed-data/tools/GenerateSeedDocs.java`; every value below is what the database holds. Long identity ids (products, categories, orders) are the values of a fresh database; UUIDs are random per environment, so records are identified by business key.

## Payments (`payment_transaction`)

A payment is created `PENDING` / `NOT_HELD` with the order's total, captured to `SUCCESS` / `HELD`, and its escrow is `RELEASED` when the order is delivered (`PaymentTransactionServiceImpl`). A failed attempt is `FAILED` and does not block a retry: O10's first card attempt failed and was retried successfully; O19's only attempt failed and the order was cancelled. FLEET_SERVICE order L2 is unpaid, so it has no payment.

| Order | Customer | Method | Status | Escrow | Reference | Amount | Currency | Held at | Processed at |
|---|---|---|---|---|---|---|---|---|---|
| ORD-1787319300000-1 | customer1.chn@lbos.com | UPI | SUCCESS | RELEASED | TXN1880147211 | Rs 520.90 | INR | 2026-08-21 19:08 IST | 2026-08-21 20:11 IST |
| ORD-1786427400000-1 | customer2.baw@lbos.com | UPI | SUCCESS | RELEASED | TXN0820351593 | Rs 561.55 | INR | 2026-08-11 11:23 IST | 2026-08-11 12:31 IST |
| ORD-1786623300000-1 | customer3.hye@lbos.com | CARD | SUCCESS | RELEASED | TXN1581510904 | Rs 1317.70 | INR | 2026-08-13 17:48 IST | 2026-08-13 18:49 IST |
| ORD-1787286000000-1 | customer2.baw@lbos.com | UPI | SUCCESS | RELEASED | TXN1799530877 | Rs 533.50 | INR | 2026-08-21 09:53 IST | 2026-08-21 10:48 IST |
| ORD-1787490000000-1 | customer5.chs@lbos.com | UPI | SUCCESS | RELEASED | TXN0959812382 | Rs 625.50 | INR | 2026-08-23 18:33 IST | 2026-08-23 19:39 IST |
| ORD-1788702000000-1 | customer1.chn@lbos.com | UPI | SUCCESS | RELEASED | TXN1853279061 | Rs 602.91 | INR | 2026-09-06 19:13 IST | 2026-09-06 20:22 IST |
| ORD-1788702000000-2 | customer1.chn@lbos.com | UPI | SUCCESS | RELEASED | TXN1853279060 | Rs 356.30 | INR | 2026-09-06 19:13 IST | 2026-09-06 20:13 IST |
| ORD-1788174600000-1 | customer2.baw@lbos.com | CARD | SUCCESS | RELEASED | TXN1509885754 | Rs 494.55 | INR | 2026-08-31 16:43 IST | 2026-08-31 17:47 IST |
| ORD-1788331500000-1 | customer6.baw@lbos.com | UPI | SUCCESS | RELEASED | TXN1913377186 | Rs 881.20 | INR | 2026-09-02 12:18 IST | 2026-09-02 13:16 IST |
| ORD-1788532500000-1 | customer4.chn@lbos.com | CARD | FAILED | NOT_HELD | TXN0866703685 | Rs 831.16 | INR | NULL | 2026-09-04 20:07 IST |
| ORD-1788532500000-1 | customer4.chn@lbos.com | CARD | SUCCESS | RELEASED | TXN1275200225 | Rs 831.16 | INR | 2026-09-04 20:11 IST | 2026-09-04 21:19 IST |
| ORD-1789026900000-1 | customer1.chn@lbos.com | UPI | SUCCESS | RELEASED | TXN1737042140 | Rs 347.80 | INR | 2026-09-10 13:28 IST | 2026-09-10 14:30 IST |
| ORD-1789129800000-1 | customer3.hye@lbos.com | CARD | SUCCESS | RELEASED | TXN1364851649 | Rs 689.45 | INR | 2026-09-11 18:03 IST | 2026-09-11 19:02 IST |
| ORD-1789293900000-1 | customer5.chs@lbos.com | UPI | SUCCESS | RELEASED | TXN2105059020 | Rs 1127.80 | INR | 2026-09-13 15:38 IST | 2026-09-13 16:43 IST |
| ORD-1789393800000-1 | customer2.baw@lbos.com | UPI | SUCCESS | RELEASED | TXN1349853418 | Rs 552.54 | INR | 2026-09-14 19:23 IST | 2026-09-14 20:20 IST |
| ORD-1789903800000-1 | customer4.chn@lbos.com | UPI | SUCCESS | HELD | TXN1773005435 | Rs 264.10 | INR | 2026-09-20 17:03 IST | NULL |
| ORD-1789903800000-2 | customer4.chn@lbos.com | UPI | SUCCESS | HELD | TXN1773005434 | Rs 561.64 | INR | 2026-09-20 17:03 IST | NULL |
| ORD-1789902600000-1 | customer6.baw@lbos.com | CARD | SUCCESS | HELD | TXN0843795654 | Rs 381.77 | INR | 2026-09-20 16:43 IST | NULL |
| ORD-1789884000000-1 | customer5.chs@lbos.com | UPI | SUCCESS | HELD | TXN0118230075 | Rs 335.76 | INR | 2026-09-20 11:33 IST | NULL |
| ORD-1789792500000-1 | customer3.hye@lbos.com | CARD | FAILED | NOT_HELD | TXN1093371168 | Rs 416.20 | INR | NULL | 2026-09-19 10:09 IST |
| ORD-1789821300000-1 | customer7.baw@lbos.com | UPI | SUCCESS | RELEASED | TXN1173256539 | Rs 387.88 | INR | 2026-09-19 18:08 IST | 2026-09-19 22:15 IST |
| ORD-1789903500000-2 | customer2.baw@lbos.com | UPI | SUCCESS | HELD | TXN1588498153 | Rs 358.34 | INR | 2026-09-20 16:58 IST | NULL |
| LOG-1788845400000 | customer3.hye@lbos.com | UPI | SUCCESS | RELEASED | TXN1450542758 | Rs 75.00 | INR | 2026-09-08 11:03 IST | 2026-09-08 11:48 IST |

## Invoices (`customer_invoice`)

An invoice is `subtotal = the order's line totals`, `tax = the order's tax`, `total = subtotal + tax` (`CustomerInvoiceServiceImpl`; delivery and platform fee are not part of it). One per delivered retail order.

| Invoice | Order | Customer | Date | Subtotal | Tax | Total | Status |
|---|---|---|---|---|---|---|---|
| INV-2026-000001 | ORD-1787319300000-1 | customer1.chn@lbos.com | 2026-08-21 | Rs 429.00 | Rs 34.32 | Rs 463.32 | ISSUED |
| INV-2026-000002 | ORD-1786427400000-1 | customer2.baw@lbos.com | 2026-08-11 | Rs 485.00 | Rs 17.85 | Rs 502.85 | ISSUED |
| INV-2026-000003 | ORD-1786623300000-1 | customer3.hye@lbos.com | 2026-08-13 | Rs 1170.00 | Rs 75.30 | Rs 1245.30 | ISSUED |
| INV-2026-000004 | ORD-1787286000000-1 | customer2.baw@lbos.com | 2026-08-21 | Rs 425.00 | Rs 51.00 | Rs 476.00 | ISSUED |
| INV-2026-000005 | ORD-1787490000000-1 | customer5.chs@lbos.com | 2026-08-23 | Rs 517.00 | Rs 49.16 | Rs 566.16 | ISSUED |
| INV-2026-000006 | ORD-1788702000000-1 | customer1.chn@lbos.com | 2026-09-06 | Rs 523.00 | Rs 20.45 | Rs 543.45 | ISSUED |
| INV-2026-000007 | ORD-1788702000000-2 | customer1.chn@lbos.com | 2026-09-06 | Rs 280.00 | Rs 21.70 | Rs 301.70 | ISSUED |
| INV-2026-000008 | ORD-1788174600000-1 | customer2.baw@lbos.com | 2026-08-31 | Rs 400.00 | Rs 37.55 | Rs 437.55 | ISSUED |
| INV-2026-000009 | ORD-1788331500000-1 | customer6.baw@lbos.com | 2026-09-02 | Rs 730.00 | Rs 87.60 | Rs 817.60 | ISSUED |
| INV-2026-000010 | ORD-1788532500000-1 | customer4.chn@lbos.com | 2026-09-04 | Rs 662.00 | Rs 106.92 | Rs 768.92 | ISSUED |
| INV-2026-000011 | ORD-1789026900000-1 | customer1.chn@lbos.com | 2026-09-10 | Rs 255.00 | Rs 38.70 | Rs 293.70 | ISSUED |
| INV-2026-000012 | ORD-1789129800000-1 | customer3.hye@lbos.com | 2026-09-11 | Rs 580.00 | Rs 48.85 | Rs 628.85 | ISSUED |
| INV-2026-000013 | ORD-1789293900000-1 | customer5.chs@lbos.com | 2026-09-13 | Rs 899.00 | Rs 161.82 | Rs 1060.82 | ISSUED |
| INV-2026-000014 | ORD-1789393800000-1 | customer2.baw@lbos.com | 2026-09-14 | Rs 497.00 | Rs 36.60 | Rs 533.60 | ISSUED |
| INV-2026-000020 | ORD-1789821300000-1 | customer7.baw@lbos.com | 2026-09-19 | Rs 304.00 | Rs 28.80 | Rs 332.80 | ISSUED |

## Settlements (`settlement`)

When an order is delivered the escrow is released and the money is split (`recordOrderDeliverySettlement`): a `RETAILER` payout per retailer (their line totals), a `FLEET_OWNER` payout (the delivery charge) and a `PLATFORM` share (platform fee + tax); the payee's business name is what the Finance screen shows. Payouts older than eight days are `COMPLETED` (paid out three days after delivery), recent ones `PENDING`. `operations_manager_id` is only used by the legacy request-based settlement flow, so it is NULL here.

| Order | Payee type | Payee | Gross | Fee | Net | Status | Date | Completed |
|---|---|---|---|---|---|---|---|---|
| ORD-1787319300000-1 | FLEET_OWNER | Chennai City Carriers | Rs 49.00 | Rs 0.00 | Rs 49.00 | COMPLETED | 2026-08-21 | 2026-08-24 20:11 IST |
| ORD-1787319300000-1 | PLATFORM | AroundU Platform | Rs 42.90 | Rs 0.00 | Rs 42.90 | COMPLETED | 2026-08-21 | 2026-08-24 20:11 IST |
| ORD-1787319300000-1 | RETAILER | Chennai Fresh Basket | Rs 429.00 | Rs 0.00 | Rs 429.00 | COMPLETED | 2026-08-21 | 2026-08-24 20:11 IST |
| ORD-1786427400000-1 | FLEET_OWNER | Bengaluru Route Logistics | Rs 49.00 | Rs 0.00 | Rs 49.00 | COMPLETED | 2026-08-11 | 2026-08-14 12:31 IST |
| ORD-1786427400000-1 | PLATFORM | AroundU Platform | Rs 27.55 | Rs 0.00 | Rs 27.55 | COMPLETED | 2026-08-11 | 2026-08-14 12:31 IST |
| ORD-1786427400000-1 | RETAILER | Bengaluru Daily Mart | Rs 485.00 | Rs 0.00 | Rs 485.00 | COMPLETED | 2026-08-11 | 2026-08-14 12:31 IST |
| ORD-1786623300000-1 | FLEET_OWNER | Deccan Fleet Services | Rs 49.00 | Rs 0.00 | Rs 49.00 | COMPLETED | 2026-08-13 | 2026-08-16 18:49 IST |
| ORD-1786623300000-1 | PLATFORM | AroundU Platform | Rs 98.70 | Rs 0.00 | Rs 98.70 | COMPLETED | 2026-08-13 | 2026-08-16 18:49 IST |
| ORD-1786623300000-1 | RETAILER | Hyderabad Harvest Store | Rs 1170.00 | Rs 0.00 | Rs 1170.00 | COMPLETED | 2026-08-13 | 2026-08-16 18:49 IST |
| ORD-1787286000000-1 | FLEET_OWNER | Bengaluru Route Logistics | Rs 49.00 | Rs 0.00 | Rs 49.00 | COMPLETED | 2026-08-21 | 2026-08-24 10:48 IST |
| ORD-1787286000000-1 | PLATFORM | AroundU Platform | Rs 59.50 | Rs 0.00 | Rs 59.50 | COMPLETED | 2026-08-21 | 2026-08-24 10:48 IST |
| ORD-1787286000000-1 | RETAILER | Bengaluru Daily Mart | Rs 425.00 | Rs 0.00 | Rs 425.00 | COMPLETED | 2026-08-21 | 2026-08-24 10:48 IST |
| ORD-1787490000000-1 | FLEET_OWNER | Chennai City Carriers | Rs 49.00 | Rs 0.00 | Rs 49.00 | COMPLETED | 2026-08-23 | 2026-08-26 19:39 IST |
| ORD-1787490000000-1 | PLATFORM | AroundU Platform | Rs 59.50 | Rs 0.00 | Rs 59.50 | COMPLETED | 2026-08-23 | 2026-08-26 19:39 IST |
| ORD-1787490000000-1 | RETAILER | Southern Spice Market | Rs 517.00 | Rs 0.00 | Rs 517.00 | COMPLETED | 2026-08-23 | 2026-08-26 19:39 IST |
| ORD-1788702000000-1 | FLEET_OWNER | Chennai City Carriers | Rs 49.00 | Rs 0.00 | Rs 49.00 | COMPLETED | 2026-09-06 | 2026-09-09 20:22 IST |
| ORD-1788702000000-1 | PLATFORM | AroundU Platform | Rs 30.91 | Rs 0.00 | Rs 30.91 | COMPLETED | 2026-09-06 | 2026-09-09 20:22 IST |
| ORD-1788702000000-1 | RETAILER | Chennai Fresh Basket | Rs 523.00 | Rs 0.00 | Rs 523.00 | COMPLETED | 2026-09-06 | 2026-09-09 20:22 IST |
| ORD-1788702000000-2 | FLEET_OWNER | Chennai City Carriers | Rs 49.00 | Rs 0.00 | Rs 49.00 | COMPLETED | 2026-09-06 | 2026-09-09 20:13 IST |
| ORD-1788702000000-2 | PLATFORM | AroundU Platform | Rs 27.30 | Rs 0.00 | Rs 27.30 | COMPLETED | 2026-09-06 | 2026-09-09 20:13 IST |
| ORD-1788702000000-2 | RETAILER | Perambur Daily Needs | Rs 280.00 | Rs 0.00 | Rs 280.00 | COMPLETED | 2026-09-06 | 2026-09-09 20:13 IST |
| ORD-1788174600000-1 | FLEET_OWNER | Bengaluru Route Logistics | Rs 49.00 | Rs 0.00 | Rs 49.00 | COMPLETED | 2026-08-31 | 2026-09-03 17:47 IST |
| ORD-1788174600000-1 | PLATFORM | AroundU Platform | Rs 45.55 | Rs 0.00 | Rs 45.55 | COMPLETED | 2026-08-31 | 2026-09-03 17:47 IST |
| ORD-1788174600000-1 | RETAILER | Bengaluru Daily Mart | Rs 400.00 | Rs 0.00 | Rs 400.00 | COMPLETED | 2026-08-31 | 2026-09-03 17:47 IST |
| ORD-1788331500000-1 | FLEET_OWNER | Bengaluru Route Logistics | Rs 49.00 | Rs 0.00 | Rs 49.00 | COMPLETED | 2026-09-02 | 2026-09-05 13:16 IST |
| ORD-1788331500000-1 | PLATFORM | AroundU Platform | Rs 102.20 | Rs 0.00 | Rs 102.20 | COMPLETED | 2026-09-02 | 2026-09-05 13:16 IST |
| ORD-1788331500000-1 | RETAILER | Bengaluru Daily Mart | Rs 730.00 | Rs 0.00 | Rs 730.00 | COMPLETED | 2026-09-02 | 2026-09-05 13:16 IST |
| ORD-1788532500000-1 | FLEET_OWNER | Chennai City Carriers | Rs 49.00 | Rs 0.00 | Rs 49.00 | COMPLETED | 2026-09-04 | 2026-09-07 21:19 IST |
| ORD-1788532500000-1 | PLATFORM | AroundU Platform | Rs 120.16 | Rs 0.00 | Rs 120.16 | COMPLETED | 2026-09-04 | 2026-09-07 21:19 IST |
| ORD-1788532500000-1 | RETAILER | Perambur Daily Needs | Rs 662.00 | Rs 0.00 | Rs 662.00 | COMPLETED | 2026-09-04 | 2026-09-07 21:19 IST |
| ORD-1789026900000-1 | FLEET_OWNER | Bengaluru Route Logistics | Rs 49.00 | Rs 0.00 | Rs 49.00 | COMPLETED | 2026-09-10 | 2026-09-13 14:30 IST |
| ORD-1789026900000-1 | PLATFORM | AroundU Platform | Rs 43.80 | Rs 0.00 | Rs 43.80 | COMPLETED | 2026-09-10 | 2026-09-13 14:30 IST |
| ORD-1789026900000-1 | RETAILER | Bengaluru Daily Mart | Rs 255.00 | Rs 0.00 | Rs 255.00 | COMPLETED | 2026-09-10 | 2026-09-13 14:30 IST |
| ORD-1789129800000-1 | FLEET_OWNER | Deccan Fleet Services | Rs 49.00 | Rs 0.00 | Rs 49.00 | COMPLETED | 2026-09-11 | 2026-09-14 19:02 IST |
| ORD-1789129800000-1 | PLATFORM | AroundU Platform | Rs 60.45 | Rs 0.00 | Rs 60.45 | COMPLETED | 2026-09-11 | 2026-09-14 19:02 IST |
| ORD-1789129800000-1 | RETAILER | Hyderabad Harvest Store | Rs 580.00 | Rs 0.00 | Rs 580.00 | COMPLETED | 2026-09-11 | 2026-09-14 19:02 IST |
| ORD-1789293900000-1 | FLEET_OWNER | Chennai City Carriers | Rs 49.00 | Rs 0.00 | Rs 49.00 | PENDING | 2026-09-13 | NULL |
| ORD-1789293900000-1 | PLATFORM | AroundU Platform | Rs 179.80 | Rs 0.00 | Rs 179.80 | PENDING | 2026-09-13 | NULL |
| ORD-1789293900000-1 | RETAILER | Southern Spice Market | Rs 899.00 | Rs 0.00 | Rs 899.00 | PENDING | 2026-09-13 | NULL |
| ORD-1789393800000-1 | FLEET_OWNER | Bengaluru Route Logistics | Rs 49.00 | Rs 0.00 | Rs 49.00 | PENDING | 2026-09-14 | NULL |
| ORD-1789393800000-1 | PLATFORM | AroundU Platform | Rs 46.54 | Rs 0.00 | Rs 46.54 | PENDING | 2026-09-14 | NULL |
| ORD-1789393800000-1 | RETAILER | Bengaluru Daily Mart | Rs 497.00 | Rs 0.00 | Rs 497.00 | PENDING | 2026-09-14 | NULL |
| ORD-1789821300000-1 | FLEET_OWNER | Bengaluru Route Logistics | Rs 49.00 | Rs 0.00 | Rs 49.00 | PENDING | 2026-09-19 | NULL |
| ORD-1789821300000-1 | PLATFORM | AroundU Platform | Rs 34.88 | Rs 0.00 | Rs 34.88 | PENDING | 2026-09-19 | NULL |
| ORD-1789821300000-1 | RETAILER | Bengaluru Daily Mart | Rs 304.00 | Rs 0.00 | Rs 304.00 | PENDING | 2026-09-19 | NULL |
| LOG-1788845400000 | FLEET_OWNER | Deccan Fleet Services | Rs 75.00 | Rs 0.00 | Rs 75.00 | COMPLETED | 2026-09-08 | 2026-09-11 11:48 IST |
| LOG-1788845400000 | PLATFORM | AroundU Platform | Rs 0.00 | Rs 0.00 | Rs 0.00 | COMPLETED | 2026-09-08 | 2026-09-11 11:48 IST |

## Refunds (`customer_refund`)

A refund is requested for one order item of a ticket's order (`REQUESTED`), then approved and completed, or rejected with the reason appended; the item's category is appended to the reason by the application. Four refunds cover all four states.

| Refund | Ticket | Order | Item | Item total | Refund | Status | Reason | Requested | Processed |
|---|---|---|---|---|---|---|---|---|---|
| RFD-2026-0001 | TKT-2026-000001 | ORD-1789293900000-1 | ELC-POWERBANK-10K | Rs 899.00 | Rs 899.00 | COMPLETED | Power bank casing cracked on delivery \| Category: Electronics | 2026-09-14 10:00 IST | 2026-09-15 12:30 IST |
| RFD-2026-0002 | TKT-2026-000002 | ORD-1787286000000-1 | PKG-BISCUIT-6PK | Rs 240.00 | Rs 120.00 | APPROVED | One butter cookie pack missing from the order \| Category: Packaged Foods | 2026-08-22 11:00 IST | NULL |
| RFD-2026-0003 | TKT-2026-000003 | ORD-1789129800000-1 | FRV-MANGO-1KG | Rs 240.00 | Rs 240.00 | REJECTED | Mangoes overripe on delivery \| Category: Fresh Produce \| Rejection: Photos show the fruit within normal ripeness | 2026-09-12 12:00 IST | 2026-09-13 16:30 IST |
| RFD-2026-0004 | TKT-2026-000004 | ORD-1789884000000-1 | GRO-TAMARIND-500 | Rs 176.00 | Rs 176.00 | REQUESTED | Order rejected by the shop after payment \| Category: Groceries & Staples | 2026-09-20 12:20 IST | NULL |

## Money overview

| Type | Status | Orders | Subtotal | Tax | Delivery | Platform fee | Discount | Total |
|---|---|---|---|---|---|---|---|---|
| FLEET_SERVICE | BOOKING_CONFIRMED | 1 | Rs 0.00 | Rs 0.00 | Rs 184.00 | Rs 0.00 | Rs 0.00 | Rs 184.00 |
| FLEET_SERVICE | DELIVERED | 1 | Rs 0.00 | Rs 0.00 | Rs 75.00 | Rs 0.00 | Rs 0.00 | Rs 75.00 |
| RETAIL | CANCELLED | 1 | Rs 360.00 | Rs 0.00 | Rs 49.00 | Rs 7.20 | Rs 0.00 | Rs 416.20 |
| RETAIL | DELIVERED | 15 | Rs 8156.00 | Rs 816.62 | Rs 735.00 | Rs 163.12 | Rs 40.00 | Rs 9830.74 |
| RETAIL | FINDING_DELIVERY_PARTNER | 2 | Rs 722.00 | Rs 85.54 | Rs 98.00 | Rs 14.44 | Rs 0.00 | Rs 919.98 |
| RETAIL | IN_TRANSIT | 1 | Rs 189.00 | Rs 22.32 | Rs 49.00 | Rs 3.78 | Rs 0.00 | Rs 264.10 |
| RETAIL | RETAILER_REJECTED | 1 | Rs 268.00 | Rs 13.40 | Rs 49.00 | Rs 5.36 | Rs 0.00 | Rs 335.76 |
| RETAIL | VEHICLE_ASSIGNED | 1 | Rs 311.00 | Rs 15.55 | Rs 49.00 | Rs 6.22 | Rs 0.00 | Rs 381.77 |

