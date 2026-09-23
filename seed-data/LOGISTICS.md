# Logistics: Bookings, Trips, Trip History (S4)

> Generated from the seeded database by `seed-data/tools/GenerateSeedDocs.java`; every value below is what the database holds. Long identity ids (products, categories, orders) are the values of a fresh database; UUIDs are random per environment, so records are identified by business key.

Trips carry an order from the delivery-partner search to the door. A fleet owner accepts an order (`TripService.create`): the trip starts `PLANNED` (history row `null -> PLANNED`, no actor) and the order becomes `VEHICLE_ASSIGNED`; the driver's pickup confirmation moves it to `IN_PROGRESS` (order `IN_TRANSIT`, pickup proof required); completing the delivery makes it `COMPLETED` (order `DELIVERED`, escrow release and settlements follow). Every trip's driver, vehicle and fleet owner belong together, the vehicle's capacity covers the order's weight, and the driver is (or was) the vehicle's assignee. Pickup / delivery proofs are image data URIs (`data:image/png;base64,...`), as the application requires.

## Logistics bookings (`logistics_booking_detail`)

Two FLEET_SERVICE orders where a customer books a vehicle directly: a delivered bike courier and a small-truck house move waiting for a driver. The delivery charge is `max(distance, minimum distance) x rate per km`, at least the minimum rate of the category (BIKE 10/km, min 2 km, min Rs 50; SMALL_TRUCK 20/km, min 5 km, min Rs 150).

### LOG-1788845400000 - BIKE (DELIVERED)

| Field | Value |
|---|---|
| Customer | customer3.hye@lbos.com |
| Vehicle reference | TS10ER5602 (BIKE) |
| Receiver | Meghana Rao, 9848099112, meghana.rao@example.com |
| Locations | `[{"type": "PICKUP", "address": "Plot 14, Survey No. 32, Uppal Industrial Area, Uppal"}, {"type": "DROP", "address": "Flat 302, Green Meadows Apartments, Habsiguda"}]` |
| Special instructions | Documents parcel - hand over to the receiver only. |
| Delivery charge / order total | Rs 75.00 / Rs 75.00 |

### LOG-1789900200000 - SMALL_TRUCK (BOOKING_CONFIRMED)

| Field | Value |
|---|---|
| Customer | customer6.baw@lbos.com |
| Vehicle reference | KA05JK4471 (MINI_TRUCK) |
| Receiver | Aditya Hegde, 9880055006, aditya.hegde@example.com |
| Locations | `[{"type": "PICKUP", "address": "Godown 12, Sampige Road Industrial Area, Malleshwaram"}, {"type": "DROP", "address": "No. 11, 5th Cross, Vijayanagar Main Road"}]` |
| Special instructions | Household goods - handle the furniture with care, two helpers needed. |
| Delivery charge / order total | Rs 184.00 / Rs 184.00 |

## Trips (`trip`)

| Trip | Order | Status | Fleet owner | Driver | Vehicle | Distance | Planned | Started | Completed |
|---|---|---|---|---|---|---|---|---|---|
| TRP-20260811-0002 | ORD-1786427400000-1 | COMPLETED | Bengaluru Route Logistics | driver3fleet1.baw@lbos.com | KA01EW3388 BIKE (30.00 kg) | 8.00 km | 2026-08-11 11:40 IST | 2026-08-11 11:52 IST | 2026-08-11 12:31 IST |
| TRP-20260813-0003 | ORD-1786623300000-1 | COMPLETED | Deccan Fleet Services | driver3fleet2.hye@lbos.com | TS10ER5602 BIKE (30.00 kg) | 6.10 km | 2026-08-13 18:05 IST | 2026-08-13 18:17 IST | 2026-08-13 18:49 IST |
| TRP-20260821-0001 | ORD-1787319300000-1 | COMPLETED | Chennai City Carriers | driver3fleet3.chn@lbos.com | TN22DM4085 BIKE (30.00 kg) | 7.10 km | 2026-08-21 19:25 IST | 2026-08-21 19:37 IST | 2026-08-21 20:11 IST |
| TRP-20260821-0004 | ORD-1787286000000-1 | COMPLETED | Bengaluru Route Logistics | driver3fleet1.baw@lbos.com | KA01EW3388 BIKE (30.00 kg) | 8.00 km | 2026-08-21 10:10 IST | 2026-08-21 10:22 IST | 2026-08-21 10:48 IST |
| TRP-20260823-0005 | ORD-1787490000000-1 | COMPLETED | Chennai City Carriers | driver3fleet3.chn@lbos.com | TN22DM4085 BIKE (30.00 kg) | 9.20 km | 2026-08-23 18:50 IST | 2026-08-23 19:02 IST | 2026-08-23 19:39 IST |
| TRP-20260831-0008 | ORD-1788174600000-1 | COMPLETED | Bengaluru Route Logistics | driver2fleet1.baw@lbos.com | KA02MN8125 MINI_TRUCK (700.00 kg) | 9.00 km | 2026-08-31 17:00 IST | 2026-08-31 17:12 IST | 2026-08-31 17:47 IST |
| TRP-20260902-0009 | ORD-1788331500000-1 | COMPLETED | Bengaluru Route Logistics | driver3fleet1.baw@lbos.com | KA01EW3388 BIKE (30.00 kg) | 3.60 km | 2026-09-02 12:35 IST | 2026-09-02 12:47 IST | 2026-09-02 13:16 IST |
| TRP-20260904-0010 | ORD-1788532500000-1 | COMPLETED | Chennai City Carriers | driver2fleet3.chn@lbos.com | TN02CK9942 MINI_TRUCK (700.00 kg) | 3.20 km | 2026-09-04 20:25 IST | 2026-09-04 20:37 IST | 2026-09-04 21:19 IST |
| TRP-20260906-0006 | ORD-1788702000000-1 | COMPLETED | Chennai City Carriers | driver1fleet3.chn@lbos.com | TN09BX5316 MINI_TRUCK (750.00 kg) | 9.60 km | 2026-09-06 19:30 IST | 2026-09-06 19:42 IST | 2026-09-06 20:22 IST |
| TRP-20260906-0007 | ORD-1788702000000-2 | COMPLETED | Chennai City Carriers | driver3fleet3.chn@lbos.com | TN22DM4085 BIKE (30.00 kg) | 7.50 km | 2026-09-06 19:30 IST | 2026-09-06 19:42 IST | 2026-09-06 20:13 IST |
| TRP-20260908-0018 | LOG-1788845400000 | COMPLETED | Deccan Fleet Services | driver3fleet2.hye@lbos.com | TS10ER5602 BIKE (30.00 kg) | 7.50 km | 2026-09-08 11:20 IST | 2026-09-08 11:32 IST | 2026-09-08 11:48 IST |
| TRP-20260910-0011 | ORD-1789026900000-1 | COMPLETED | Bengaluru Route Logistics | driver1fleet1.baw@lbos.com | KA05JK4471 MINI_TRUCK (750.00 kg) | 8.50 km | 2026-09-10 13:45 IST | 2026-09-10 13:57 IST | 2026-09-10 14:30 IST |
| TRP-20260911-0012 | ORD-1789129800000-1 | COMPLETED | Deccan Fleet Services | driver3fleet2.hye@lbos.com | TS10ER5602 BIKE (30.00 kg) | 3.00 km | 2026-09-11 18:20 IST | 2026-09-11 18:32 IST | 2026-09-11 19:02 IST |
| TRP-20260913-0013 | ORD-1789293900000-1 | COMPLETED | Chennai City Carriers | driver3fleet3.chn@lbos.com | TN22DM4085 BIKE (30.00 kg) | 6.50 km | 2026-09-13 15:55 IST | 2026-09-13 16:07 IST | 2026-09-13 16:43 IST |
| TRP-20260914-0014 | ORD-1789393800000-1 | COMPLETED | Bengaluru Route Logistics | driver3fleet1.baw@lbos.com | KA01EW3388 BIKE (30.00 kg) | 2.80 km | 2026-09-14 19:40 IST | 2026-09-14 19:52 IST | 2026-09-14 20:20 IST |
| TRP-20260919-0017 | ORD-1789821300000-1 | COMPLETED | Bengaluru Route Logistics | driver3fleet1.baw@lbos.com | KA01EW3388 BIKE (30.00 kg) | 2.70 km | 2026-09-19 18:25 IST | 2026-09-19 18:37 IST | 2026-09-19 22:15 IST |
| TRP-20260920-0015 | ORD-1789903800000-1 | IN_PROGRESS | Chennai City Carriers | driver1fleet3.chn@lbos.com | TN09BX5316 MINI_TRUCK (750.00 kg) | 9.00 km | 2026-09-20 17:20 IST | 2026-09-20 17:32 IST | NULL |
| TRP-20260920-0016 | ORD-1789902600000-1 | PLANNED | Bengaluru Route Logistics | driver2fleet1.baw@lbos.com | KA02MN8125 MINI_TRUCK (700.00 kg) | 10.90 km | 2026-09-20 17:00 IST | NULL | NULL |

## Trip status history (`trip_status_history`)

| Trip | From | To | Changed at | Changed by |
|---|---|---|---|---|
| TRP-20260811-0002 | NULL | PLANNED | 2026-08-11 11:35 IST | NULL |
| TRP-20260811-0002 | PLANNED | IN_PROGRESS | 2026-08-11 11:52 IST | fleet1.baw@lbos.com |
| TRP-20260811-0002 | IN_PROGRESS | COMPLETED | 2026-08-11 12:31 IST | fleet1.baw@lbos.com |
| TRP-20260813-0003 | NULL | PLANNED | 2026-08-13 18:00 IST | NULL |
| TRP-20260813-0003 | PLANNED | IN_PROGRESS | 2026-08-13 18:17 IST | fleet2.hye@lbos.com |
| TRP-20260813-0003 | IN_PROGRESS | COMPLETED | 2026-08-13 18:49 IST | fleet2.hye@lbos.com |
| TRP-20260821-0001 | NULL | PLANNED | 2026-08-21 19:20 IST | NULL |
| TRP-20260821-0001 | PLANNED | IN_PROGRESS | 2026-08-21 19:37 IST | fleet3.chn@lbos.com |
| TRP-20260821-0001 | IN_PROGRESS | COMPLETED | 2026-08-21 20:11 IST | fleet3.chn@lbos.com |
| TRP-20260821-0004 | NULL | PLANNED | 2026-08-21 10:05 IST | NULL |
| TRP-20260821-0004 | PLANNED | IN_PROGRESS | 2026-08-21 10:22 IST | fleet1.baw@lbos.com |
| TRP-20260821-0004 | IN_PROGRESS | COMPLETED | 2026-08-21 10:48 IST | fleet1.baw@lbos.com |
| TRP-20260823-0005 | NULL | PLANNED | 2026-08-23 18:45 IST | NULL |
| TRP-20260823-0005 | PLANNED | IN_PROGRESS | 2026-08-23 19:02 IST | fleet3.chn@lbos.com |
| TRP-20260823-0005 | IN_PROGRESS | COMPLETED | 2026-08-23 19:39 IST | fleet3.chn@lbos.com |
| TRP-20260831-0008 | NULL | PLANNED | 2026-08-31 16:55 IST | NULL |
| TRP-20260831-0008 | PLANNED | IN_PROGRESS | 2026-08-31 17:12 IST | fleet1.baw@lbos.com |
| TRP-20260831-0008 | IN_PROGRESS | COMPLETED | 2026-08-31 17:47 IST | fleet1.baw@lbos.com |
| TRP-20260902-0009 | NULL | PLANNED | 2026-09-02 12:30 IST | NULL |
| TRP-20260902-0009 | PLANNED | IN_PROGRESS | 2026-09-02 12:47 IST | fleet1.baw@lbos.com |
| TRP-20260902-0009 | IN_PROGRESS | COMPLETED | 2026-09-02 13:16 IST | fleet1.baw@lbos.com |
| TRP-20260904-0010 | NULL | PLANNED | 2026-09-04 20:20 IST | NULL |
| TRP-20260904-0010 | PLANNED | IN_PROGRESS | 2026-09-04 20:37 IST | fleet3.chn@lbos.com |
| TRP-20260904-0010 | IN_PROGRESS | COMPLETED | 2026-09-04 21:19 IST | fleet3.chn@lbos.com |
| TRP-20260906-0006 | NULL | PLANNED | 2026-09-06 19:25 IST | NULL |
| TRP-20260906-0006 | PLANNED | IN_PROGRESS | 2026-09-06 19:42 IST | fleet3.chn@lbos.com |
| TRP-20260906-0006 | IN_PROGRESS | COMPLETED | 2026-09-06 20:22 IST | fleet3.chn@lbos.com |
| TRP-20260906-0007 | NULL | PLANNED | 2026-09-06 19:25 IST | NULL |
| TRP-20260906-0007 | PLANNED | IN_PROGRESS | 2026-09-06 19:42 IST | fleet3.chn@lbos.com |
| TRP-20260906-0007 | IN_PROGRESS | COMPLETED | 2026-09-06 20:13 IST | fleet3.chn@lbos.com |
| TRP-20260908-0018 | NULL | PLANNED | 2026-09-08 11:15 IST | NULL |
| TRP-20260908-0018 | PLANNED | IN_PROGRESS | 2026-09-08 11:32 IST | fleet2.hye@lbos.com |
| TRP-20260908-0018 | IN_PROGRESS | COMPLETED | 2026-09-08 11:48 IST | fleet2.hye@lbos.com |
| TRP-20260910-0011 | NULL | PLANNED | 2026-09-10 13:40 IST | NULL |
| TRP-20260910-0011 | PLANNED | IN_PROGRESS | 2026-09-10 13:57 IST | fleet1.baw@lbos.com |
| TRP-20260910-0011 | IN_PROGRESS | COMPLETED | 2026-09-10 14:30 IST | fleet1.baw@lbos.com |
| TRP-20260911-0012 | NULL | PLANNED | 2026-09-11 18:15 IST | NULL |
| TRP-20260911-0012 | PLANNED | IN_PROGRESS | 2026-09-11 18:32 IST | fleet2.hye@lbos.com |
| TRP-20260911-0012 | IN_PROGRESS | COMPLETED | 2026-09-11 19:02 IST | fleet2.hye@lbos.com |
| TRP-20260913-0013 | NULL | PLANNED | 2026-09-13 15:50 IST | NULL |
| TRP-20260913-0013 | PLANNED | IN_PROGRESS | 2026-09-13 16:07 IST | fleet3.chn@lbos.com |
| TRP-20260913-0013 | IN_PROGRESS | COMPLETED | 2026-09-13 16:43 IST | fleet3.chn@lbos.com |
| TRP-20260914-0014 | NULL | PLANNED | 2026-09-14 19:35 IST | NULL |
| TRP-20260914-0014 | PLANNED | IN_PROGRESS | 2026-09-14 19:52 IST | fleet1.baw@lbos.com |
| TRP-20260914-0014 | IN_PROGRESS | COMPLETED | 2026-09-14 20:20 IST | fleet1.baw@lbos.com |
| TRP-20260919-0017 | NULL | PLANNED | 2026-09-19 18:20 IST | NULL |
| TRP-20260919-0017 | PLANNED | IN_PROGRESS | 2026-09-19 18:37 IST | fleet1.baw@lbos.com |
| TRP-20260919-0017 | IN_PROGRESS | COMPLETED | 2026-09-19 22:15 IST | fleet1.baw@lbos.com |
| TRP-20260920-0015 | NULL | PLANNED | 2026-09-20 17:15 IST | NULL |
| TRP-20260920-0015 | PLANNED | IN_PROGRESS | 2026-09-20 17:32 IST | fleet3.chn@lbos.com |
| TRP-20260920-0016 | NULL | PLANNED | 2026-09-20 16:55 IST | NULL |

