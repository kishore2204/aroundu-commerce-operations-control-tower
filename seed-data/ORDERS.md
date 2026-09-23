# Orders (S4)

> Generated from the seeded database by `seed-data/tools/GenerateSeedDocs.java`; every value below is what the database holds. Long identity ids (products, categories, orders) are the values of a fresh database; UUIDs are random per environment, so records are identified by business key.

## How the orders were produced

Checkout creates **one RETAIL order per retailer** (`CheckoutServiceImpl` splits the cart by retailer; the order number is `ORD-<epoch ms>-<n>`); the orders of one checkout share the customer and the placement moment. The two multi-retailer checkouts are therefore *two orders each*:

```text
Customer 1's cart (Chennai Fresh Basket + Perambur Daily Needs)  ->  checkout  ->  O6 (Chennai Fresh Basket) + O7 (Perambur Daily Needs)
Customer 4's cart (Chennai Fresh Basket + Perambur Daily Needs)  ->  checkout  ->  O15 (Chennai Fresh Basket) + O16 (Perambur Daily Needs)
```

Money follows the checkout formulas: line total = quantity x unit price; tax per line from S6's tax rule of the category in the delivery state; delivery charge Rs 49.00 per retailer order; platform fee 2% of the subtotal; reward-point discount off the total (only O14 redeems points: Rs 40.00); `total = subtotal + tax + delivery + platform fee - discount`. Status follows the OrderService / TripService state machines. The keys O1-O21 (retail) and L1-L2 (logistics bookings) are the keys of the seed plan and are used throughout these documents. `statusHistoryJson` lists the transitions (the application itself leaves `[]`; the seed fills it so the timeline is visible), `orderTrackingJson` is `{}` as the application writes it.

## Overview

| Key / id | Order number | Type | Customer | Delivery zone | Retailer | Status | Payment | Total | Trip |
|---|---|---|---|---|---|---|---|---|---|
| **O1** #1 | ORD-1787319300000-1 | RETAIL | customer1.chn@lbos.com | North | Chennai Fresh Basket | DELIVERED | UPI / PAID | Rs 520.90 | TRP-20260821-0001 |
| **O2** #2 | ORD-1786427400000-1 | RETAIL | customer2.baw@lbos.com | West | Bengaluru Daily Mart | DELIVERED | UPI / PAID | Rs 561.55 | TRP-20260811-0002 |
| **O3** #3 | ORD-1786623300000-1 | RETAIL | customer3.hye@lbos.com | East | Hyderabad Harvest Store | DELIVERED | CARD / PAID | Rs 1317.70 | TRP-20260813-0003 |
| **O4** #4 | ORD-1787286000000-1 | RETAIL | customer2.baw@lbos.com | West | Bengaluru Daily Mart | DELIVERED | UPI / PAID | Rs 533.50 | TRP-20260821-0004 |
| **O5** #5 | ORD-1787490000000-1 | RETAIL | customer5.chs@lbos.com | South | Southern Spice Market | DELIVERED | UPI / PAID | Rs 625.50 | TRP-20260823-0005 |
| **O6** #6 | ORD-1788702000000-1 | RETAIL | customer1.chn@lbos.com | North | Chennai Fresh Basket | DELIVERED | UPI / PAID | Rs 602.91 | TRP-20260906-0006 |
| **O7** #7 | ORD-1788702000000-2 | RETAIL | customer1.chn@lbos.com | North | Perambur Daily Needs | DELIVERED | UPI / PAID | Rs 356.30 | TRP-20260906-0007 |
| **O8** #8 | ORD-1788174600000-1 | RETAIL | customer2.baw@lbos.com | West | Bengaluru Daily Mart | DELIVERED | CARD / PAID | Rs 494.55 | TRP-20260831-0008 |
| **O9** #9 | ORD-1788331500000-1 | RETAIL | customer6.baw@lbos.com | West | Bengaluru Daily Mart | DELIVERED | UPI / PAID | Rs 881.20 | TRP-20260902-0009 |
| **O10** #10 | ORD-1788532500000-1 | RETAIL | customer4.chn@lbos.com | North | Perambur Daily Needs | DELIVERED | CARD / PAID | Rs 831.16 | TRP-20260904-0010 |
| **O11** #11 | ORD-1789026900000-1 | RETAIL | customer1.chn@lbos.com | West | Bengaluru Daily Mart | DELIVERED | UPI / PAID | Rs 347.80 | TRP-20260910-0011 |
| **O12** #12 | ORD-1789129800000-1 | RETAIL | customer3.hye@lbos.com | East | Hyderabad Harvest Store | DELIVERED | CARD / PAID | Rs 689.45 | TRP-20260911-0012 |
| **O13** #13 | ORD-1789293900000-1 | RETAIL | customer5.chs@lbos.com | South | Southern Spice Market | DELIVERED | UPI / PAID | Rs 1127.80 | TRP-20260913-0013 |
| **O14** #14 | ORD-1789393800000-1 | RETAIL | customer2.baw@lbos.com | West | Bengaluru Daily Mart | DELIVERED | UPI / PAID | Rs 552.54 | TRP-20260914-0014 |
| **O15** #15 | ORD-1789903800000-1 | RETAIL | customer4.chn@lbos.com | North | Chennai Fresh Basket | IN_TRANSIT | UPI / PAID | Rs 264.10 | TRP-20260920-0015 |
| **O16** #16 | ORD-1789903800000-2 | RETAIL | customer4.chn@lbos.com | North | Perambur Daily Needs | FINDING_DELIVERY_PARTNER | UPI / PAID | Rs 561.64 | — |
| **O17** #17 | ORD-1789902600000-1 | RETAIL | customer6.baw@lbos.com | West | Bengaluru Daily Mart | VEHICLE_ASSIGNED | CARD / PAID | Rs 381.77 | TRP-20260920-0016 |
| **O18** #18 | ORD-1789884000000-1 | RETAIL | customer5.chs@lbos.com | South | Southern Spice Market | RETAILER_REJECTED | UPI / PAID | Rs 335.76 | — |
| **O19** #19 | ORD-1789792500000-1 | RETAIL | customer3.hye@lbos.com | East | Hyderabad Harvest Store | CANCELLED | CARD / PENDING | Rs 416.20 | — |
| **O20** #20 | ORD-1789821300000-1 | RETAIL | customer7.baw@lbos.com | West | Bengaluru Daily Mart | DELIVERED | UPI / PAID | Rs 387.88 | TRP-20260919-0017 |
| **O21** #21 | ORD-1789903500000-2 | RETAIL | customer2.baw@lbos.com | West | Bengaluru Daily Mart | FINDING_DELIVERY_PARTNER | UPI / PAID | Rs 358.34 | — |
| **L1** #22 | LOG-1788845400000 | FLEET_SERVICE | customer3.hye@lbos.com | — | — | DELIVERED | UPI / PAID | Rs 75.00 | TRP-20260908-0018 |
| **L2** #23 | LOG-1789900200000 | FLEET_SERVICE | customer6.baw@lbos.com | West | — | BOOKING_CONFIRMED | UPI / PENDING | Rs 184.00 | — |

## O1 - ORD-1787319300000-1 (id 1)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Priya Ramanathan - customer1.chn@lbos.com |
| Delivery address | Flat 4B, Sri Lakshmi Apartments, 22 Paper Mills Road, Perambur, North, Chennai |
| Delivery position (lat, long) | 13.110800, 80.241900 |
| Placed | 2026-08-21 19:05 IST |
| Status | DELIVERED |
| Last update | 2026-08-21 20:11 IST |
| Payment method / status | UPI / PAID |
| Payment reference | TXN1880147211 |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-08-21T19:05"}, {"status": "WAITING_FOR_RETAILER", "changedAt": "2026-08-21T19:06"}, {"status": "RETAILER_ACCEPTED", "changedAt": "2026-08-21T19:14"}, {"status": "FINDING_DELIVERY_PARTNER", "changedAt": "2026-08-21T19:14"}, {"status": "VEHICLE_ASSIGNED", "changedAt": "2026-08-21T19:20"}, {"status": "IN_TRANSIT", "changedAt": "2026-08-21T19:37"}, {"status": "DELIVERED", "changedAt": "2026-08-21T20:11"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Chennai Fresh Basket | GRO-TOORDAL-1KG | Toor Dal 1kg | Groceries & Staples | 2 | Rs 165.00 | Rs 0.00 | Rs 330.00 | 1.000 kg | no |
| Chennai Fresh Basket | HHE-DISHWASH-500 | Lemon Dishwash Liquid 500ml | Household Essentials | 1 | Rs 99.00 | Rs 0.00 | Rs 99.00 | 0.550 kg | no |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 429.00 | Rs 0.00 | Rs 34.32 | Rs 49.00 | Rs 8.58 | **Rs 520.90** |

Payment: SUCCESS / escrow RELEASED, amount Rs 520.90, held 2026-08-21 19:08 IST, released 2026-08-21 20:11 IST, reference TXN1880147211.

Trip: TRP-20260821-0001 (COMPLETED) - driver Arun Pandian (driver3fleet3.chn@lbos.com), vehicle TN22DM4085 BIKE, fleet Chennai City Carriers, 7.10 km, planned 2026-08-21 19:25 IST, started 2026-08-21 19:37 IST, completed 2026-08-21 20:11 IST.

Invoice: INV-2026-000001 dated 2026-08-21, subtotal Rs 429.00 + tax Rs 34.32 = Rs 463.32 (ISSUED).

## O2 - ORD-1786427400000-1 (id 2)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Rahul Deshpande - customer2.baw@lbos.com |
| Delivery address | No. 42, 3rd Cross, Basaveshwaranagar, Near Hanumanthappa Circle, West, Bengaluru |
| Delivery position (lat, long) | 12.989900, 77.538500 |
| Placed | 2026-08-11 11:20 IST |
| Status | DELIVERED |
| Last update | 2026-08-11 12:31 IST |
| Payment method / status | UPI / PAID |
| Payment reference | TXN0820351593 |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-08-11T11:20"}, {"status": "WAITING_FOR_RETAILER", "changedAt": "2026-08-11T11:21"}, {"status": "RETAILER_ACCEPTED", "changedAt": "2026-08-11T11:29"}, {"status": "FINDING_DELIVERY_PARTNER", "changedAt": "2026-08-11T11:29"}, {"status": "VEHICLE_ASSIGNED", "changedAt": "2026-08-11T11:35"}, {"status": "IN_TRANSIT", "changedAt": "2026-08-11T11:52"}, {"status": "DELIVERED", "changedAt": "2026-08-11T12:31"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Bengaluru Daily Mart | FRV-ONION-2KG | Nashik Onions 2kg | Fresh Produce | 2 | Rs 64.00 | Rs 0.00 | Rs 128.00 | 2.000 kg | no |
| Bengaluru Daily Mart | GRO-ATTA-5KG | Whole Wheat Atta 5kg | Groceries & Staples | 1 | Rs 265.00 | Rs 0.00 | Rs 265.00 | 5.000 kg | no |
| Bengaluru Daily Mart | GRO-SUGAR-1KG | Refined Sugar 1kg | Groceries & Staples | 2 | Rs 46.00 | Rs 0.00 | Rs 92.00 | 1.000 kg | no |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 485.00 | Rs 0.00 | Rs 17.85 | Rs 49.00 | Rs 9.70 | **Rs 561.55** |

Payment: SUCCESS / escrow RELEASED, amount Rs 561.55, held 2026-08-11 11:23 IST, released 2026-08-11 12:31 IST, reference TXN0820351593.

Trip: TRP-20260811-0002 (COMPLETED) - driver Ganesh Naik (driver3fleet1.baw@lbos.com), vehicle KA01EW3388 BIKE, fleet Bengaluru Route Logistics, 8.00 km, planned 2026-08-11 11:40 IST, started 2026-08-11 11:52 IST, completed 2026-08-11 12:31 IST.

Invoice: INV-2026-000002 dated 2026-08-11, subtotal Rs 485.00 + tax Rs 17.85 = Rs 502.85 (ISSUED).

## O3 - ORD-1786623300000-1 (id 3)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Anjali Reddy - customer3.hye@lbos.com |
| Delivery address | H.No. 6-3-112, Sri Sai Nagar Colony, Uppal, East, Hyderabad |
| Delivery position (lat, long) | 17.400800, 78.560300 |
| Placed | 2026-08-13 17:45 IST |
| Status | DELIVERED |
| Last update | 2026-08-13 18:49 IST |
| Payment method / status | CARD / PAID |
| Payment reference | TXN1581510904 |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-08-13T17:45"}, {"status": "WAITING_FOR_RETAILER", "changedAt": "2026-08-13T17:46"}, {"status": "RETAILER_ACCEPTED", "changedAt": "2026-08-13T17:54"}, {"status": "FINDING_DELIVERY_PARTNER", "changedAt": "2026-08-13T17:54"}, {"status": "VEHICLE_ASSIGNED", "changedAt": "2026-08-13T18:00"}, {"status": "IN_TRANSIT", "changedAt": "2026-08-13T18:17"}, {"status": "DELIVERED", "changedAt": "2026-08-13T18:49"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Hyderabad Harvest Store | GRO-BASMATI-5KG | Long Grain Basmati Rice 5kg | Groceries & Staples | 1 | Rs 620.00 | Rs 0.00 | Rs 620.00 | 5.000 kg | no |
| Hyderabad Harvest Store | GRO-OIL-1L | Refined Sunflower Oil 1L | Groceries & Staples | 2 | Rs 155.00 | Rs 0.00 | Rs 310.00 | 0.920 kg | no |
| Hyderabad Harvest Store | BEV-TEA-500 | Assam CTC Tea 500g | Beverages | 1 | Rs 240.00 | Rs 0.00 | Rs 240.00 | 0.520 kg | no |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 1170.00 | Rs 0.00 | Rs 75.30 | Rs 49.00 | Rs 23.40 | **Rs 1317.70** |

Payment: SUCCESS / escrow RELEASED, amount Rs 1317.70, held 2026-08-13 17:48 IST, released 2026-08-13 18:49 IST, reference TXN1581510904.

Trip: TRP-20260813-0003 (COMPLETED) - driver Vamsi Krishna (driver3fleet2.hye@lbos.com), vehicle TS10ER5602 BIKE, fleet Deccan Fleet Services, 6.10 km, planned 2026-08-13 18:05 IST, started 2026-08-13 18:17 IST, completed 2026-08-13 18:49 IST.

Invoice: INV-2026-000003 dated 2026-08-13, subtotal Rs 1170.00 + tax Rs 75.30 = Rs 1245.30 (ISSUED).

## O4 - ORD-1787286000000-1 (id 4)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Rahul Deshpande - customer2.baw@lbos.com |
| Delivery address | No. 42, 3rd Cross, Basaveshwaranagar, Near Hanumanthappa Circle, West, Bengaluru |
| Delivery position (lat, long) | 12.989900, 77.538500 |
| Placed | 2026-08-21 09:50 IST |
| Status | DELIVERED |
| Last update | 2026-08-21 10:48 IST |
| Payment method / status | UPI / PAID |
| Payment reference | TXN1799530877 |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-08-21T09:50"}, {"status": "WAITING_FOR_RETAILER", "changedAt": "2026-08-21T09:51"}, {"status": "RETAILER_ACCEPTED", "changedAt": "2026-08-21T09:59"}, {"status": "FINDING_DELIVERY_PARTNER", "changedAt": "2026-08-21T09:59"}, {"status": "VEHICLE_ASSIGNED", "changedAt": "2026-08-21T10:05"}, {"status": "IN_TRANSIT", "changedAt": "2026-08-21T10:22"}, {"status": "DELIVERED", "changedAt": "2026-08-21T10:48"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Bengaluru Daily Mart | BEV-COFFEE-200 | Filter Coffee Powder 200g | Beverages | 1 | Rs 185.00 | Rs 0.00 | Rs 185.00 | 0.220 kg | no |
| Bengaluru Daily Mart | PKG-BISCUIT-6PK | Butter Cookies Family Pack 6x60g | Packaged Foods | 2 | Rs 120.00 | Rs 0.00 | Rs 240.00 | 0.400 kg | no |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 425.00 | Rs 0.00 | Rs 51.00 | Rs 49.00 | Rs 8.50 | **Rs 533.50** |

Payment: SUCCESS / escrow RELEASED, amount Rs 533.50, held 2026-08-21 09:53 IST, released 2026-08-21 10:48 IST, reference TXN1799530877.

Trip: TRP-20260821-0004 (COMPLETED) - driver Ganesh Naik (driver3fleet1.baw@lbos.com), vehicle KA01EW3388 BIKE, fleet Bengaluru Route Logistics, 8.00 km, planned 2026-08-21 10:10 IST, started 2026-08-21 10:22 IST, completed 2026-08-21 10:48 IST.

Invoice: INV-2026-000004 dated 2026-08-21, subtotal Rs 425.00 + tax Rs 51.00 = Rs 476.00 (ISSUED).

## O5 - ORD-1787490000000-1 (id 5)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Sneha Raghavan - customer5.chs@lbos.com |
| Delivery address | 18, Second Main Road, Kasturba Nagar, Adyar, South, Chennai |
| Delivery position (lat, long) | 13.001200, 80.256500 |
| Placed | 2026-08-23 18:30 IST |
| Status | DELIVERED |
| Last update | 2026-08-23 19:39 IST |
| Payment method / status | UPI / PAID |
| Payment reference | TXN0959812382 |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-08-23T18:30"}, {"status": "WAITING_FOR_RETAILER", "changedAt": "2026-08-23T18:31"}, {"status": "RETAILER_ACCEPTED", "changedAt": "2026-08-23T18:39"}, {"status": "FINDING_DELIVERY_PARTNER", "changedAt": "2026-08-23T18:39"}, {"status": "VEHICLE_ASSIGNED", "changedAt": "2026-08-23T18:45"}, {"status": "IN_TRANSIT", "changedAt": "2026-08-23T19:02"}, {"status": "DELIVERED", "changedAt": "2026-08-23T19:39"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Southern Spice Market | GRO-SAMBAR-200 | Sambar Powder 200g | Groceries & Staples | 2 | Rs 92.00 | Rs 0.00 | Rs 184.00 | 0.210 kg | no |
| Southern Spice Market | PKG-PAPAD-200 | Appalam Papad 200g | Packaged Foods | 3 | Rs 55.00 | Rs 0.00 | Rs 165.00 | 0.210 kg | no |
| Southern Spice Market | BEV-BUTTERMILK-6PK | Spiced Buttermilk 200ml x6 | Beverages | 2 | Rs 84.00 | Rs 0.00 | Rs 168.00 | 1.300 kg | no |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 517.00 | Rs 0.00 | Rs 49.16 | Rs 49.00 | Rs 10.34 | **Rs 625.50** |

Payment: SUCCESS / escrow RELEASED, amount Rs 625.50, held 2026-08-23 18:33 IST, released 2026-08-23 19:39 IST, reference TXN0959812382.

Trip: TRP-20260823-0005 (COMPLETED) - driver Arun Pandian (driver3fleet3.chn@lbos.com), vehicle TN22DM4085 BIKE, fleet Chennai City Carriers, 9.20 km, planned 2026-08-23 18:50 IST, started 2026-08-23 19:02 IST, completed 2026-08-23 19:39 IST.

Invoice: INV-2026-000005 dated 2026-08-23, subtotal Rs 517.00 + tax Rs 49.16 = Rs 566.16 (ISSUED).

## O6 - ORD-1788702000000-1 (id 6)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Priya Ramanathan - customer1.chn@lbos.com |
| Delivery address | Flat 4B, Sri Lakshmi Apartments, 22 Paper Mills Road, Perambur, North, Chennai |
| Delivery position (lat, long) | 13.110800, 80.241900 |
| Placed | 2026-09-06 19:10 IST |
| Status | DELIVERED |
| Last update | 2026-09-06 20:22 IST |
| Payment method / status | UPI / PAID |
| Payment reference | TXN1853279061 |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-09-06T19:10"}, {"status": "WAITING_FOR_RETAILER", "changedAt": "2026-09-06T19:11"}, {"status": "RETAILER_ACCEPTED", "changedAt": "2026-09-06T19:19"}, {"status": "FINDING_DELIVERY_PARTNER", "changedAt": "2026-09-06T19:19"}, {"status": "VEHICLE_ASSIGNED", "changedAt": "2026-09-06T19:25"}, {"status": "IN_TRANSIT", "changedAt": "2026-09-06T19:42"}, {"status": "DELIVERED", "changedAt": "2026-09-06T20:22"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Chennai Fresh Basket | FRV-TOMATO-1KG | Farm Fresh Tomatoes 1kg | Fresh Produce | 3 | Rs 38.00 | Rs 0.00 | Rs 114.00 | 1.000 kg | no |
| Chennai Fresh Basket | GRO-SONAMASURI-5 | Sona Masoori Rice 5kg | Groceries & Staples | 1 | Rs 349.00 | Rs 0.00 | Rs 349.00 | 5.000 kg | no |
| Chennai Fresh Basket | DAI-MILK-500 | Full Cream Milk 500ml | Dairy & Bakery | 2 | Rs 30.00 | Rs 0.00 | Rs 60.00 | 0.520 kg | no |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 523.00 | Rs 0.00 | Rs 20.45 | Rs 49.00 | Rs 10.46 | **Rs 602.91** |

Payment: SUCCESS / escrow RELEASED, amount Rs 602.91, held 2026-09-06 19:13 IST, released 2026-09-06 20:22 IST, reference TXN1853279061.

Trip: TRP-20260906-0006 (COMPLETED) - driver Murugan Selvam (driver1fleet3.chn@lbos.com), vehicle TN09BX5316 MINI_TRUCK, fleet Chennai City Carriers, 9.60 km, planned 2026-09-06 19:30 IST, started 2026-09-06 19:42 IST, completed 2026-09-06 20:22 IST.

Invoice: INV-2026-000006 dated 2026-09-06, subtotal Rs 523.00 + tax Rs 20.45 = Rs 543.45 (ISSUED).

## O7 - ORD-1788702000000-2 (id 7)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Priya Ramanathan - customer1.chn@lbos.com |
| Delivery address | Flat 4B, Sri Lakshmi Apartments, 22 Paper Mills Road, Perambur, North, Chennai |
| Delivery position (lat, long) | 13.110800, 80.241900 |
| Placed | 2026-09-06 19:10 IST |
| Status | DELIVERED |
| Last update | 2026-09-06 20:13 IST |
| Payment method / status | UPI / PAID |
| Payment reference | TXN1853279060 |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-09-06T19:10"}, {"status": "WAITING_FOR_RETAILER", "changedAt": "2026-09-06T19:11"}, {"status": "RETAILER_ACCEPTED", "changedAt": "2026-09-06T19:19"}, {"status": "FINDING_DELIVERY_PARTNER", "changedAt": "2026-09-06T19:19"}, {"status": "VEHICLE_ASSIGNED", "changedAt": "2026-09-06T19:25"}, {"status": "IN_TRANSIT", "changedAt": "2026-09-06T19:42"}, {"status": "DELIVERED", "changedAt": "2026-09-06T20:13"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Perambur Daily Needs | DAI-CURD-400 | Fresh Set Curd 400g | Dairy & Bakery | 2 | Rs 40.00 | Rs 0.00 | Rs 80.00 | 0.420 kg | no |
| Perambur Daily Needs | DAI-BREAD-400 | Whole Wheat Sandwich Bread 400g | Dairy & Bakery | 2 | Rs 45.00 | Rs 0.00 | Rs 90.00 | 0.400 kg | no |
| Perambur Daily Needs | BEV-JUICE-1L | Mixed Fruit Juice 1L | Beverages | 1 | Rs 110.00 | Rs 0.00 | Rs 110.00 | 1.050 kg | no |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 280.00 | Rs 0.00 | Rs 21.70 | Rs 49.00 | Rs 5.60 | **Rs 356.30** |

Payment: SUCCESS / escrow RELEASED, amount Rs 356.30, held 2026-09-06 19:13 IST, released 2026-09-06 20:13 IST, reference TXN1853279060.

Trip: TRP-20260906-0007 (COMPLETED) - driver Arun Pandian (driver3fleet3.chn@lbos.com), vehicle TN22DM4085 BIKE, fleet Chennai City Carriers, 7.50 km, planned 2026-09-06 19:30 IST, started 2026-09-06 19:42 IST, completed 2026-09-06 20:13 IST.

Invoice: INV-2026-000007 dated 2026-09-06, subtotal Rs 280.00 + tax Rs 21.70 = Rs 301.70 (ISSUED).

## O8 - ORD-1788174600000-1 (id 8)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Rahul Deshpande - customer2.baw@lbos.com |
| Delivery address | No. 42, 3rd Cross, Basaveshwaranagar, Near Hanumanthappa Circle, West, Bengaluru |
| Delivery position (lat, long) | 12.989900, 77.538500 |
| Placed | 2026-08-31 16:40 IST |
| Status | DELIVERED |
| Last update | 2026-08-31 17:47 IST |
| Payment method / status | CARD / PAID |
| Payment reference | TXN1509885754 |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-08-31T16:40"}, {"status": "WAITING_FOR_RETAILER", "changedAt": "2026-08-31T16:41"}, {"status": "RETAILER_ACCEPTED", "changedAt": "2026-08-31T16:49"}, {"status": "FINDING_DELIVERY_PARTNER", "changedAt": "2026-08-31T16:49"}, {"status": "VEHICLE_ASSIGNED", "changedAt": "2026-08-31T16:55"}, {"status": "IN_TRANSIT", "changedAt": "2026-08-31T17:12"}, {"status": "DELIVERED", "changedAt": "2026-08-31T17:47"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Bengaluru Daily Mart | HHE-DETERGENT-1KG | Detergent Powder 1kg | Household Essentials | 1 | Rs 135.00 | Rs 0.00 | Rs 135.00 | 1.020 kg | no |
| Bengaluru Daily Mart | GRO-ATTA-5KG | Whole Wheat Atta 5kg | Groceries & Staples | 1 | Rs 265.00 | Rs 0.00 | Rs 265.00 | 5.000 kg | no |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 400.00 | Rs 0.00 | Rs 37.55 | Rs 49.00 | Rs 8.00 | **Rs 494.55** |

Payment: SUCCESS / escrow RELEASED, amount Rs 494.55, held 2026-08-31 16:43 IST, released 2026-08-31 17:47 IST, reference TXN1509885754.

Trip: TRP-20260831-0008 (COMPLETED) - driver Mahesh Babu (driver2fleet1.baw@lbos.com), vehicle KA02MN8125 MINI_TRUCK, fleet Bengaluru Route Logistics, 9.00 km, planned 2026-08-31 17:00 IST, started 2026-08-31 17:12 IST, completed 2026-08-31 17:47 IST.

Invoice: INV-2026-000008 dated 2026-08-31, subtotal Rs 400.00 + tax Rs 37.55 = Rs 437.55 (ISSUED).

## O9 - ORD-1788331500000-1 (id 9)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Aditya Hegde - customer6.baw@lbos.com |
| Delivery address | No. 11, 5th Cross, Vijayanagar Main Road, Vijayanagar, West, Bengaluru |
| Delivery position (lat, long) | 12.971900, 77.534300 |
| Placed | 2026-09-02 12:15 IST |
| Status | DELIVERED |
| Last update | 2026-09-02 13:16 IST |
| Payment method / status | UPI / PAID |
| Payment reference | TXN1913377186 |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-09-02T12:15"}, {"status": "WAITING_FOR_RETAILER", "changedAt": "2026-09-02T12:16"}, {"status": "RETAILER_ACCEPTED", "changedAt": "2026-09-02T12:24"}, {"status": "FINDING_DELIVERY_PARTNER", "changedAt": "2026-09-02T12:24"}, {"status": "VEHICLE_ASSIGNED", "changedAt": "2026-09-02T12:30"}, {"status": "IN_TRANSIT", "changedAt": "2026-09-02T12:47"}, {"status": "DELIVERED", "changedAt": "2026-09-02T13:16"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Bengaluru Daily Mart | BEV-COFFEE-200 | Filter Coffee Powder 200g | Beverages | 2 | Rs 185.00 | Rs 0.00 | Rs 370.00 | 0.220 kg | no |
| Bengaluru Daily Mart | PKG-BISCUIT-6PK | Butter Cookies Family Pack 6x60g | Packaged Foods | 3 | Rs 120.00 | Rs 0.00 | Rs 360.00 | 0.400 kg | no |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 730.00 | Rs 0.00 | Rs 87.60 | Rs 49.00 | Rs 14.60 | **Rs 881.20** |

Payment: SUCCESS / escrow RELEASED, amount Rs 881.20, held 2026-09-02 12:18 IST, released 2026-09-02 13:16 IST, reference TXN1913377186.

Trip: TRP-20260902-0009 (COMPLETED) - driver Ganesh Naik (driver3fleet1.baw@lbos.com), vehicle KA01EW3388 BIKE, fleet Bengaluru Route Logistics, 3.60 km, planned 2026-09-02 12:35 IST, started 2026-09-02 12:47 IST, completed 2026-09-02 13:16 IST.

Invoice: INV-2026-000009 dated 2026-09-02, subtotal Rs 730.00 + tax Rs 87.60 = Rs 817.60 (ISSUED).

## O10 - ORD-1788532500000-1 (id 10)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Vignesh Kannan - customer4.chn@lbos.com |
| Delivery address | 7/22, Gandhi Street, Kolathur, Near Kolathur Bus Stand, North, Chennai |
| Delivery position (lat, long) | 13.119500, 80.221400 |
| Placed | 2026-09-04 20:05 IST |
| Status | DELIVERED |
| Last update | 2026-09-04 21:19 IST |
| Payment method / status | CARD / PAID |
| Payment reference | TXN1275200225 |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-09-04T20:05"}, {"status": "WAITING_FOR_RETAILER", "changedAt": "2026-09-04T20:06"}, {"status": "RETAILER_ACCEPTED", "changedAt": "2026-09-04T20:14"}, {"status": "FINDING_DELIVERY_PARTNER", "changedAt": "2026-09-04T20:14"}, {"status": "VEHICLE_ASSIGNED", "changedAt": "2026-09-04T20:20"}, {"status": "IN_TRANSIT", "changedAt": "2026-09-04T20:37"}, {"status": "DELIVERED", "changedAt": "2026-09-04T21:19"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Perambur Daily Needs | PKG-NOODLES-4PK | Masala Instant Noodles 4-Pack | Packaged Foods | 3 | Rs 68.00 | Rs 0.00 | Rs 204.00 | 0.350 kg | no |
| Perambur Daily Needs | PCR-SOAP-4PK | Sandalwood Bath Soap 4-Pack | Personal Care | 2 | Rs 140.00 | Rs 0.00 | Rs 280.00 | 0.500 kg | no |
| Perambur Daily Needs | ELC-LEDBULB-9W | 9W LED Bulb Cool Daylight | Electronics | 2 | Rs 89.00 | Rs 0.00 | Rs 178.00 | 0.080 kg | no |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 662.00 | Rs 0.00 | Rs 106.92 | Rs 49.00 | Rs 13.24 | **Rs 831.16** |

Payment: SUCCESS / escrow RELEASED, amount Rs 831.16, held 2026-09-04 20:11 IST, released 2026-09-04 21:19 IST, reference TXN1275200225; FAILED attempt TXN0866703685 at 2026-09-04 20:07 IST.

Trip: TRP-20260904-0010 (COMPLETED) - driver Prakash Raj (driver2fleet3.chn@lbos.com), vehicle TN02CK9942 MINI_TRUCK, fleet Chennai City Carriers, 3.20 km, planned 2026-09-04 20:25 IST, started 2026-09-04 20:37 IST, completed 2026-09-04 21:19 IST.

Invoice: INV-2026-000010 dated 2026-09-04, subtotal Rs 662.00 + tax Rs 106.92 = Rs 768.92 (ISSUED).

## O11 - ORD-1789026900000-1 (id 11)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Priya Ramanathan - customer1.chn@lbos.com |
| Delivery address | Third Floor, Tech Park Block C, 80 Feet Road, Rajajinagar, West, Bengaluru |
| Delivery position (lat, long) | 12.991500, 77.556000 |
| Placed | 2026-09-10 13:25 IST |
| Status | DELIVERED |
| Last update | 2026-09-10 14:30 IST |
| Payment method / status | UPI / PAID |
| Payment reference | TXN1737042140 |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-09-10T13:25"}, {"status": "WAITING_FOR_RETAILER", "changedAt": "2026-09-10T13:26"}, {"status": "RETAILER_ACCEPTED", "changedAt": "2026-09-10T13:34"}, {"status": "FINDING_DELIVERY_PARTNER", "changedAt": "2026-09-10T13:34"}, {"status": "VEHICLE_ASSIGNED", "changedAt": "2026-09-10T13:40"}, {"status": "IN_TRANSIT", "changedAt": "2026-09-10T13:57"}, {"status": "DELIVERED", "changedAt": "2026-09-10T14:30"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Bengaluru Daily Mart | HHE-DETERGENT-1KG | Detergent Powder 1kg | Household Essentials | 1 | Rs 135.00 | Rs 0.00 | Rs 135.00 | 1.020 kg | no |
| Bengaluru Daily Mart | PKG-BISCUIT-6PK | Butter Cookies Family Pack 6x60g | Packaged Foods | 1 | Rs 120.00 | Rs 0.00 | Rs 120.00 | 0.400 kg | no |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 255.00 | Rs 0.00 | Rs 38.70 | Rs 49.00 | Rs 5.10 | **Rs 347.80** |

Payment: SUCCESS / escrow RELEASED, amount Rs 347.80, held 2026-09-10 13:28 IST, released 2026-09-10 14:30 IST, reference TXN1737042140.

Trip: TRP-20260910-0011 (COMPLETED) - driver Harish Kumar (driver1fleet1.baw@lbos.com), vehicle KA05JK4471 MINI_TRUCK, fleet Bengaluru Route Logistics, 8.50 km, planned 2026-09-10 13:45 IST, started 2026-09-10 13:57 IST, completed 2026-09-10 14:30 IST.

Invoice: INV-2026-000011 dated 2026-09-10, subtotal Rs 255.00 + tax Rs 38.70 = Rs 293.70 (ISSUED).

## O12 - ORD-1789129800000-1 (id 12)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Anjali Reddy - customer3.hye@lbos.com |
| Delivery address | H.No. 6-3-112, Sri Sai Nagar Colony, Uppal, East, Hyderabad |
| Delivery position (lat, long) | 17.400800, 78.560300 |
| Placed | 2026-09-11 18:00 IST |
| Status | DELIVERED |
| Last update | 2026-09-11 19:02 IST |
| Payment method / status | CARD / PAID |
| Payment reference | TXN1364851649 |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-09-11T18:00"}, {"status": "WAITING_FOR_RETAILER", "changedAt": "2026-09-11T18:01"}, {"status": "RETAILER_ACCEPTED", "changedAt": "2026-09-11T18:09"}, {"status": "FINDING_DELIVERY_PARTNER", "changedAt": "2026-09-11T18:09"}, {"status": "VEHICLE_ASSIGNED", "changedAt": "2026-09-11T18:15"}, {"status": "IN_TRANSIT", "changedAt": "2026-09-11T18:32"}, {"status": "DELIVERED", "changedAt": "2026-09-11T19:02"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Hyderabad Harvest Store | PCR-SHAMPOO-340 | Herbal Anti-Dandruff Shampoo 340ml | Personal Care | 1 | Rs 245.00 | Rs 0.00 | Rs 245.00 | 0.380 kg | no |
| Hyderabad Harvest Store | FRV-MANGO-1KG | Banganapalli Mangoes 1kg | Fresh Produce | 2 | Rs 120.00 | Rs 0.00 | Rs 240.00 | 1.000 kg | no |
| Hyderabad Harvest Store | DAI-PANEER-200 | Fresh Paneer 200g | Dairy & Bakery | 1 | Rs 95.00 | Rs 0.00 | Rs 95.00 | 0.210 kg | no |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 580.00 | Rs 0.00 | Rs 48.85 | Rs 49.00 | Rs 11.60 | **Rs 689.45** |

Payment: SUCCESS / escrow RELEASED, amount Rs 689.45, held 2026-09-11 18:03 IST, released 2026-09-11 19:02 IST, reference TXN1364851649.

Trip: TRP-20260911-0012 (COMPLETED) - driver Vamsi Krishna (driver3fleet2.hye@lbos.com), vehicle TS10ER5602 BIKE, fleet Deccan Fleet Services, 3.00 km, planned 2026-09-11 18:20 IST, started 2026-09-11 18:32 IST, completed 2026-09-11 19:02 IST.

Invoice: INV-2026-000012 dated 2026-09-11, subtotal Rs 580.00 + tax Rs 48.85 = Rs 628.85 (ISSUED).

## O13 - ORD-1789293900000-1 (id 13)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Sneha Raghavan - customer5.chs@lbos.com |
| Delivery address | 18, Second Main Road, Kasturba Nagar, Adyar, South, Chennai |
| Delivery position (lat, long) | 13.001200, 80.256500 |
| Placed | 2026-09-13 15:35 IST |
| Status | DELIVERED |
| Last update | 2026-09-13 16:43 IST |
| Payment method / status | UPI / PAID |
| Payment reference | TXN2105059020 |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-09-13T15:35"}, {"status": "WAITING_FOR_RETAILER", "changedAt": "2026-09-13T15:36"}, {"status": "RETAILER_ACCEPTED", "changedAt": "2026-09-13T15:44"}, {"status": "FINDING_DELIVERY_PARTNER", "changedAt": "2026-09-13T15:44"}, {"status": "VEHICLE_ASSIGNED", "changedAt": "2026-09-13T15:50"}, {"status": "IN_TRANSIT", "changedAt": "2026-09-13T16:07"}, {"status": "DELIVERED", "changedAt": "2026-09-13T16:43"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Southern Spice Market | ELC-POWERBANK-10K | 10000mAh Power Bank | Electronics | 1 | Rs 899.00 | Rs 0.00 | Rs 899.00 | 0.250 kg | no |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 899.00 | Rs 0.00 | Rs 161.82 | Rs 49.00 | Rs 17.98 | **Rs 1127.80** |

Payment: SUCCESS / escrow RELEASED, amount Rs 1127.80, held 2026-09-13 15:38 IST, released 2026-09-13 16:43 IST, reference TXN2105059020.

Trip: TRP-20260913-0013 (COMPLETED) - driver Arun Pandian (driver3fleet3.chn@lbos.com), vehicle TN22DM4085 BIKE, fleet Chennai City Carriers, 6.50 km, planned 2026-09-13 15:55 IST, started 2026-09-13 16:07 IST, completed 2026-09-13 16:43 IST.

Invoice: INV-2026-000013 dated 2026-09-13, subtotal Rs 899.00 + tax Rs 161.82 = Rs 1060.82 (ISSUED).

## O14 - ORD-1789393800000-1 (id 14)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Rahul Deshpande - customer2.baw@lbos.com |
| Delivery address | No. 42, 3rd Cross, Basaveshwaranagar, Near Hanumanthappa Circle, West, Bengaluru |
| Delivery position (lat, long) | 12.989900, 77.538500 |
| Placed | 2026-09-14 19:20 IST |
| Status | DELIVERED |
| Last update | 2026-09-14 20:20 IST |
| Payment method / status | UPI / PAID |
| Payment reference | TXN1349853418 |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-09-14T19:20"}, {"status": "WAITING_FOR_RETAILER", "changedAt": "2026-09-14T19:21"}, {"status": "RETAILER_ACCEPTED", "changedAt": "2026-09-14T19:29"}, {"status": "FINDING_DELIVERY_PARTNER", "changedAt": "2026-09-14T19:29"}, {"status": "VEHICLE_ASSIGNED", "changedAt": "2026-09-14T19:35"}, {"status": "IN_TRANSIT", "changedAt": "2026-09-14T19:52"}, {"status": "DELIVERED", "changedAt": "2026-09-14T20:20"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Bengaluru Daily Mart | BEV-COFFEE-200 | Filter Coffee Powder 200g | Beverages | 1 | Rs 185.00 | Rs 0.00 | Rs 185.00 | 0.220 kg | no |
| Bengaluru Daily Mart | FRV-ONION-2KG | Nashik Onions 2kg | Fresh Produce | 3 | Rs 64.00 | Rs 0.00 | Rs 192.00 | 2.000 kg | no |
| Bengaluru Daily Mart | PKG-BISCUIT-6PK | Butter Cookies Family Pack 6x60g | Packaged Foods | 1 | Rs 120.00 | Rs 0.00 | Rs 120.00 | 0.400 kg | no |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 497.00 | Rs 40.00 | Rs 36.60 | Rs 49.00 | Rs 9.94 | **Rs 552.54** |

Payment: SUCCESS / escrow RELEASED, amount Rs 552.54, held 2026-09-14 19:23 IST, released 2026-09-14 20:20 IST, reference TXN1349853418.

Trip: TRP-20260914-0014 (COMPLETED) - driver Ganesh Naik (driver3fleet1.baw@lbos.com), vehicle KA01EW3388 BIKE, fleet Bengaluru Route Logistics, 2.80 km, planned 2026-09-14 19:40 IST, started 2026-09-14 19:52 IST, completed 2026-09-14 20:20 IST.

Invoice: INV-2026-000014 dated 2026-09-14, subtotal Rs 497.00 + tax Rs 36.60 = Rs 533.60 (ISSUED).

## O15 - ORD-1789903800000-1 (id 15)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Vignesh Kannan - customer4.chn@lbos.com |
| Delivery address | 7/22, Gandhi Street, Kolathur, Near Kolathur Bus Stand, North, Chennai |
| Delivery position (lat, long) | 13.119500, 80.221400 |
| Placed | 2026-09-20 17:00 IST |
| Status | IN_TRANSIT |
| Last update | 2026-09-20 17:32 IST |
| Payment method / status | UPI / PAID |
| Payment reference | TXN1773005435 |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-09-20T17:00"}, {"status": "WAITING_FOR_RETAILER", "changedAt": "2026-09-20T17:01"}, {"status": "RETAILER_ACCEPTED", "changedAt": "2026-09-20T17:09"}, {"status": "FINDING_DELIVERY_PARTNER", "changedAt": "2026-09-20T17:09"}, {"status": "VEHICLE_ASSIGNED", "changedAt": "2026-09-20T17:15"}, {"status": "IN_TRANSIT", "changedAt": "2026-09-20T17:32"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Chennai Fresh Basket | DAI-MILK-500 | Full Cream Milk 500ml | Dairy & Bakery | 3 | Rs 30.00 | Rs 0.00 | Rs 90.00 | 0.520 kg | no |
| Chennai Fresh Basket | HHE-DISHWASH-500 | Lemon Dishwash Liquid 500ml | Household Essentials | 1 | Rs 99.00 | Rs 0.00 | Rs 99.00 | 0.550 kg | no |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 189.00 | Rs 0.00 | Rs 22.32 | Rs 49.00 | Rs 3.78 | **Rs 264.10** |

Payment: SUCCESS / escrow HELD, amount Rs 264.10, held 2026-09-20 17:03 IST, released NULL, reference TXN1773005435.

Trip: TRP-20260920-0015 (IN_PROGRESS) - driver Murugan Selvam (driver1fleet3.chn@lbos.com), vehicle TN09BX5316 MINI_TRUCK, fleet Chennai City Carriers, 9.00 km, planned 2026-09-20 17:20 IST, started 2026-09-20 17:32 IST, completed NULL.

## O16 - ORD-1789903800000-2 (id 16)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Vignesh Kannan - customer4.chn@lbos.com |
| Delivery address | 7/22, Gandhi Street, Kolathur, Near Kolathur Bus Stand, North, Chennai |
| Delivery position (lat, long) | 13.119500, 80.221400 |
| Placed | 2026-09-20 17:00 IST |
| Status | FINDING_DELIVERY_PARTNER |
| Last update | 2026-09-20 17:09 IST |
| Payment method / status | UPI / PAID |
| Payment reference | TXN1773005434 |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-09-20T17:00"}, {"status": "WAITING_FOR_RETAILER", "changedAt": "2026-09-20T17:01"}, {"status": "RETAILER_ACCEPTED", "changedAt": "2026-09-20T17:09"}, {"status": "FINDING_DELIVERY_PARTNER", "changedAt": "2026-09-20T17:09"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Perambur Daily Needs | BEV-JUICE-1L | Mixed Fruit Juice 1L | Beverages | 2 | Rs 110.00 | Rs 0.00 | Rs 220.00 | 1.050 kg | no |
| Perambur Daily Needs | PKG-NOODLES-4PK | Masala Instant Noodles 4-Pack | Packaged Foods | 2 | Rs 68.00 | Rs 0.00 | Rs 136.00 | 0.350 kg | no |
| Perambur Daily Needs | ELC-LEDBULB-9W | 9W LED Bulb Cool Daylight | Electronics | 1 | Rs 89.00 | Rs 0.00 | Rs 89.00 | 0.080 kg | no |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 445.00 | Rs 0.00 | Rs 58.74 | Rs 49.00 | Rs 8.90 | **Rs 561.64** |

Payment: SUCCESS / escrow HELD, amount Rs 561.64, held 2026-09-20 17:03 IST, released NULL, reference TXN1773005434.

Trip: none (FINDING_DELIVERY_PARTNER).

## O17 - ORD-1789902600000-1 (id 17)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Aditya Hegde - customer6.baw@lbos.com |
| Delivery address | No. 11, 5th Cross, Vijayanagar Main Road, Vijayanagar, West, Bengaluru |
| Delivery position (lat, long) | 12.971900, 77.534300 |
| Placed | 2026-09-20 16:40 IST |
| Status | VEHICLE_ASSIGNED |
| Last update | 2026-09-20 16:55 IST |
| Payment method / status | CARD / PAID |
| Payment reference | TXN0843795654 |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-09-20T16:40"}, {"status": "WAITING_FOR_RETAILER", "changedAt": "2026-09-20T16:41"}, {"status": "RETAILER_ACCEPTED", "changedAt": "2026-09-20T16:49"}, {"status": "FINDING_DELIVERY_PARTNER", "changedAt": "2026-09-20T16:49"}, {"status": "VEHICLE_ASSIGNED", "changedAt": "2026-09-20T16:55"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Bengaluru Daily Mart | GRO-ATTA-5KG | Whole Wheat Atta 5kg | Groceries & Staples | 1 | Rs 265.00 | Rs 0.00 | Rs 265.00 | 5.000 kg | no |
| Bengaluru Daily Mart | GRO-SUGAR-1KG | Refined Sugar 1kg | Groceries & Staples | 1 | Rs 46.00 | Rs 0.00 | Rs 46.00 | 1.000 kg | no |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 311.00 | Rs 0.00 | Rs 15.55 | Rs 49.00 | Rs 6.22 | **Rs 381.77** |

Payment: SUCCESS / escrow HELD, amount Rs 381.77, held 2026-09-20 16:43 IST, released NULL, reference TXN0843795654.

Trip: TRP-20260920-0016 (PLANNED) - driver Mahesh Babu (driver2fleet1.baw@lbos.com), vehicle KA02MN8125 MINI_TRUCK, fleet Bengaluru Route Logistics, 10.90 km, planned 2026-09-20 17:00 IST, started NULL, completed NULL.

## O18 - ORD-1789884000000-1 (id 18)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Sneha Raghavan - customer5.chs@lbos.com |
| Delivery address | 18, Second Main Road, Kasturba Nagar, Adyar, South, Chennai |
| Delivery position (lat, long) | 13.001200, 80.256500 |
| Placed | 2026-09-20 11:30 IST |
| Status | RETAILER_REJECTED |
| Last update | 2026-09-20 11:36 IST |
| Payment method / status | UPI / PAID |
| Payment reference | TXN0118230075 |
| Cancellation | Sorry, Sambar Powder is out of stock today (fee Rs NULL, NULL) |
| Status history | `[{"status": "NEW", "changedAt": "2026-09-20T11:30"}, {"status": "WAITING_FOR_RETAILER", "changedAt": "2026-09-20T11:31"}, {"status": "RETAILER_REJECTED", "changedAt": "2026-09-20T11:36"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Southern Spice Market | GRO-SAMBAR-200 | Sambar Powder 200g | Groceries & Staples | 1 | Rs 92.00 | Rs 0.00 | Rs 92.00 | 0.210 kg | no |
| Southern Spice Market | GRO-TAMARIND-500 | Seedless Tamarind 500g | Groceries & Staples | 2 | Rs 88.00 | Rs 0.00 | Rs 176.00 | 0.510 kg | no |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 268.00 | Rs 0.00 | Rs 13.40 | Rs 49.00 | Rs 5.36 | **Rs 335.76** |

Payment: SUCCESS / escrow HELD, amount Rs 335.76, held 2026-09-20 11:33 IST, released NULL, reference TXN0118230075.

Trip: none (RETAILER_REJECTED).

## O19 - ORD-1789792500000-1 (id 19)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Anjali Reddy - customer3.hye@lbos.com |
| Delivery address | H.No. 6-3-112, Sri Sai Nagar Colony, Uppal, East, Hyderabad |
| Delivery position (lat, long) | 17.400800, 78.560300 |
| Placed | 2026-09-19 10:05 IST |
| Status | CANCELLED |
| Last update | 2026-09-19 10:30 IST |
| Payment method / status | CARD / PENDING |
| Payment reference | NULL |
| Cancellation | Payment could not be completed - cancelled by the customer (fee Rs 0.00, 2026-09-19 10:30 IST) |
| Status history | `[{"status": "NEW", "changedAt": "2026-09-19T10:05"}, {"status": "CANCELLED", "changedAt": "2026-09-19T10:30"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Hyderabad Harvest Store | FRV-MANGO-1KG | Banganapalli Mangoes 1kg | Fresh Produce | 3 | Rs 120.00 | Rs 0.00 | Rs 360.00 | 1.000 kg | yes |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 360.00 | Rs 0.00 | Rs 0.00 | Rs 49.00 | Rs 7.20 | **Rs 416.20** |

Payment: no successful payment; FAILED attempt TXN1093371168 at 2026-09-19 10:09 IST.

Trip: none (CANCELLED).

## O20 - ORD-1789821300000-1 (id 20)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Kavya Bhat - customer7.baw@lbos.com |
| Delivery address | No. 27, 8th Main, Malleshwaram, Near Sampige Road, West, Bengaluru |
| Delivery position (lat, long) | 13.003500, 77.571000 |
| Placed | 2026-09-19 18:05 IST |
| Status | DELIVERED |
| Last update | 2026-09-19 22:15 IST |
| Payment method / status | UPI / PAID |
| Payment reference | TXN1173256539 |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-09-19T18:05"}, {"status": "WAITING_FOR_RETAILER", "changedAt": "2026-09-19T18:06"}, {"status": "RETAILER_ACCEPTED", "changedAt": "2026-09-19T18:14"}, {"status": "FINDING_DELIVERY_PARTNER", "changedAt": "2026-09-19T18:14"}, {"status": "VEHICLE_ASSIGNED", "changedAt": "2026-09-19T18:20"}, {"status": "IN_TRANSIT", "changedAt": "2026-09-19T18:37"}, {"status": "DELIVERED", "changedAt": "2026-09-19T22:15"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Bengaluru Daily Mart | PKG-BISCUIT-6PK | Butter Cookies Family Pack 6x60g | Packaged Foods | 2 | Rs 120.00 | Rs 0.00 | Rs 240.00 | 0.400 kg | no |
| Bengaluru Daily Mart | FRV-ONION-2KG | Nashik Onions 2kg | Fresh Produce | 1 | Rs 64.00 | Rs 0.00 | Rs 64.00 | 2.000 kg | no |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 304.00 | Rs 0.00 | Rs 28.80 | Rs 49.00 | Rs 6.08 | **Rs 387.88** |

Payment: SUCCESS / escrow RELEASED, amount Rs 387.88, held 2026-09-19 18:08 IST, released 2026-09-19 22:15 IST, reference TXN1173256539.

Trip: TRP-20260919-0017 (COMPLETED) - driver Ganesh Naik (driver3fleet1.baw@lbos.com), vehicle KA01EW3388 BIKE, fleet Bengaluru Route Logistics, 2.70 km, planned 2026-09-19 18:25 IST, started 2026-09-19 18:37 IST, completed 2026-09-19 22:15 IST.

Invoice: INV-2026-000020 dated 2026-09-19, subtotal Rs 304.00 + tax Rs 28.80 = Rs 332.80 (ISSUED).

## O21 - ORD-1789903500000-2 (id 21)

| Field | Value |
|---|---|
| Type | RETAIL |
| Customer | Rahul Deshpande - customer2.baw@lbos.com |
| Delivery address | No. 42, 3rd Cross, Basaveshwaranagar, Near Hanumanthappa Circle, West, Bengaluru |
| Delivery position (lat, long) | 12.989900, 77.538500 |
| Placed | 2026-09-20 16:55 IST |
| Status | FINDING_DELIVERY_PARTNER |
| Last update | 2026-09-20 17:04 IST |
| Payment method / status | UPI / PAID |
| Payment reference | TXN1588498153 |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-09-20T16:55"}, {"status": "WAITING_FOR_RETAILER", "changedAt": "2026-09-20T16:56"}, {"status": "RETAILER_ACCEPTED", "changedAt": "2026-09-20T17:04"}, {"status": "FINDING_DELIVERY_PARTNER", "changedAt": "2026-09-20T17:04"}]` |

| Retailer | SKU | Product | Category | Qty | Unit price | Discount | Line total | Weight | Stock restored |
|---|---|---|---|---|---|---|---|---|---|
| Bengaluru Daily Mart | GRO-SUGAR-1KG | Refined Sugar 1kg | Groceries & Staples | 2 | Rs 46.00 | Rs 0.00 | Rs 92.00 | 1.000 kg | no |
| Bengaluru Daily Mart | BEV-COFFEE-200 | Filter Coffee Powder 200g | Beverages | 1 | Rs 185.00 | Rs 0.00 | Rs 185.00 | 0.220 kg | no |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 277.00 | Rs 0.00 | Rs 26.80 | Rs 49.00 | Rs 5.54 | **Rs 358.34** |

Payment: SUCCESS / escrow HELD, amount Rs 358.34, held 2026-09-20 16:58 IST, released NULL, reference TXN1588498153.

Trip: none (FINDING_DELIVERY_PARTNER).

## L1 - LOG-1788845400000 (id 22)

| Field | Value |
|---|---|
| Type | FLEET_SERVICE |
| Customer | Anjali Reddy - customer3.hye@lbos.com |
| Delivery address | Flat 302, Green Meadows Apartments, Habsiguda |
| Delivery position (lat, long) | 17.410200, 78.544500 |
| Placed | 2026-09-08 11:00 IST |
| Status | DELIVERED |
| Last update | 2026-09-08 11:48 IST |
| Payment method / status | UPI / PAID |
| Payment reference | TXN1450542758 |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-09-08T11:00"}, {"status": "BOOKING_CONFIRMED", "changedAt": "2026-09-08T11:02"}, {"status": "VEHICLE_ASSIGNED", "changedAt": "2026-09-08T11:20"}, {"status": "IN_TRANSIT", "changedAt": "2026-09-08T11:32"}, {"status": "DELIVERED", "changedAt": "2026-09-08T11:48"}]` |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 0.00 | Rs 0.00 | Rs 0.00 | Rs 75.00 | Rs 0.00 | **Rs 75.00** |

Payment: SUCCESS / escrow RELEASED, amount Rs 75.00, held 2026-09-08 11:03 IST, released 2026-09-08 11:48 IST, reference TXN1450542758.

Trip: TRP-20260908-0018 (COMPLETED) - driver Vamsi Krishna (driver3fleet2.hye@lbos.com), vehicle TS10ER5602 BIKE, fleet Deccan Fleet Services, 7.50 km, planned 2026-09-08 11:20 IST, started 2026-09-08 11:32 IST, completed 2026-09-08 11:48 IST.

## L2 - LOG-1789900200000 (id 23)

| Field | Value |
|---|---|
| Type | FLEET_SERVICE |
| Customer | Aditya Hegde - customer6.baw@lbos.com |
| Delivery address | No. 11, 5th Cross, Vijayanagar Main Road |
| Delivery position (lat, long) | 12.971900, 77.534300 |
| Placed | 2026-09-20 16:00 IST |
| Status | BOOKING_CONFIRMED |
| Last update | 2026-09-20 16:02 IST |
| Payment method / status | UPI / PENDING |
| Payment reference | NULL |
| Cancellation | — |
| Status history | `[{"status": "NEW", "changedAt": "2026-09-20T16:00"}, {"status": "BOOKING_CONFIRMED", "changedAt": "2026-09-20T16:02"}]` |

| Subtotal | Discount | Tax | Delivery fee | Platform fee | **Total** |
|---|---|---|---|---|---|
| Rs 0.00 | Rs 0.00 | Rs 0.00 | Rs 184.00 | Rs 0.00 | **Rs 184.00** |

Payment: no successful payment.

Trip: none (BOOKING_CONFIRMED).

