# Support (S6)

> Generated from the seeded database by `seed-data/tools/GenerateSeedDocs.java`; every value below is what the database holds. Long identity ids (products, categories, orders) are the values of a fresh database; UUIDs are random per environment, so records are identified by business key.

Eleven tickets covering every status (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`), all four raiser roles the taxonomy validates (customer, retailer, fleet owner, driver) and both escalation styles. Category / sub-category always come from `SupportTicketCategories` for the raiser's role. `due_by` = raised + the priority's SLA (LOW 72 h, MEDIUM 24 h, HIGH 4 h). Only ticket T11 is `OPEN` (LOW, well within its SLA), so the SLA scheduler will not touch the seeded data.

## Tickets

| Ticket | Raised by | Category / sub-category | Priority | Status | Assigned to | Order | Subject | Raised | Due by | Resolved | Escalated to | In cluster |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TKT-2026-000001 | CUSTOMER: customer5.chs@lbos.com | ORDER_ISSUE / ITEM_DAMAGED | HIGH | CLOSED | support1@lbos.com | ORD-1789293900000-1 | Power bank arrived with a cracked casing | 2026-09-14 09:30 IST | 2026-09-14 13:30 IST | 2026-09-15 12:00 IST | — | no |
| TKT-2026-000002 | CUSTOMER: customer2.baw@lbos.com | ORDER_ISSUE / ITEM_MISSING | MEDIUM | RESOLVED | support2@lbos.com | ORD-1787286000000-1 | One pack of butter cookies missing from my order | 2026-08-22 10:15 IST | 2026-08-23 10:15 IST | 2026-08-23 15:00 IST | — | no |
| TKT-2026-000003 | CUSTOMER: customer3.hye@lbos.com | ORDER_ISSUE / ITEM_DAMAGED | MEDIUM | RESOLVED | support1@lbos.com | ORD-1789129800000-1 | Mangoes were overripe on delivery | 2026-09-12 11:00 IST | 2026-09-13 11:00 IST | 2026-09-13 16:30 IST | — | no |
| TKT-2026-000004 | CUSTOMER: customer5.chs@lbos.com | ORDER_ISSUE / ORDER_CANCELLED_BY_RETAILER | MEDIUM | IN_PROGRESS | support1@lbos.com | ORD-1789884000000-1 | Order rejected by the shop after payment | 2026-09-20 12:10 IST | 2026-09-21 12:10 IST | NULL | entity RETAILER | no |
| TKT-2026-000005 | CUSTOMER: customer6.baw@lbos.com | ORDER_ISSUE / LATE_DELIVERY | HIGH | IN_PROGRESS | support2@lbos.com | ORD-1789902600000-1 | Delivery partner has not picked up my order | 2026-09-20 17:30 IST | 2026-09-20 21:30 IST | NULL | — | yes |
| TKT-2026-000006 | CUSTOMER: customer2.baw@lbos.com | ORDER_ISSUE / LATE_DELIVERY | MEDIUM | IN_PROGRESS | support2@lbos.com | ORD-1789903500000-2 | Order still waiting for a delivery partner | 2026-09-20 17:40 IST | 2026-09-21 17:40 IST | NULL | — | yes |
| TKT-2026-000007 | CUSTOMER: customer7.baw@lbos.com | ORDER_ISSUE / LATE_DELIVERY | MEDIUM | IN_PROGRESS | support1@lbos.com | ORD-1789821300000-1 | Order arrived more than four hours late | 2026-09-19 22:40 IST | 2026-09-20 22:40 IST | NULL | — | yes |
| TKT-2026-000008 | RETAILER: retailer2.baw@lbos.com | PAYOUT_SETTLEMENT / SETTLEMENT_DELAYED | MEDIUM | RESOLVED | support1@lbos.com | ORD-1789393800000-1 | Payout for a delivered order still pending | 2026-09-15 10:45 IST | 2026-09-16 10:45 IST | 2026-09-16 14:20 IST | — | no |
| TKT-2026-000009 | FLEET_MANAGER: fleet1.baw@lbos.com | PAYMENT_EXPENSE / EXPENSE_NOT_APPROVED | LOW | IN_PROGRESS | support2@lbos.com | NULL | Repair expense submitted but not approved | 2026-09-10 15:00 IST | 2026-09-13 15:00 IST | NULL | role OPERATIONS_MANAGER | no |
| TKT-2026-000010 | DRIVER: driver1fleet3.chn@lbos.com | TRIP_ISSUE / INCORRECT_ROUTE_INFO | LOW | CLOSED | support2@lbos.com | NULL | Drop location pin was wrong on the trip | 2026-09-05 13:05 IST | 2026-09-08 13:05 IST | 2026-09-06 11:00 IST | — | no |
| TKT-2026-000011 | CUSTOMER: customer1.chn@lbos.com | ACCOUNT_ISSUE / PROFILE_UPDATE_ISSUE | LOW | OPEN | NULL | NULL | Cannot update the second delivery address | 2026-09-20 09:00 IST | 2026-09-23 09:00 IST | NULL | — | no |

## Ticket descriptions and conversations (`support_ticket_message`)

### TKT-2026-000001 - Power bank arrived with a cracked casing

> The 10000mAh power bank from my order was delivered with a visibly cracked casing and it does not charge. I have photos of the damage.

| Sent | Sender role | Sender | Internal note | Message |
|---|---|---|---|---|
| 2026-09-14 09:35 IST | CUSTOMER | customer5.chs@lbos.com | no | The photos of the cracked casing are attached to my order. It does not charge at all. |
| 2026-09-14 11:05 IST | SUPPORT_STAFF | support1@lbos.com | no | Sorry about that, Sneha. I have checked the delivery photo and the damage is clear. I am raising a full refund for the power bank. |
| 2026-09-14 11:30 IST | SUPPORT_STAFF | support1@lbos.com | yes | Internal: item damaged in transit, retailer confirmed it was packed correctly. Refund of Rs 899.00 approved. |
| 2026-09-14 13:30 IST | CUSTOMER | customer5.chs@lbos.com | no | Thank you for the quick response. |

### TKT-2026-000002 - One pack of butter cookies missing from my order

> I ordered two family packs of butter cookies but only one pack was in the bag. Please refund the missing pack.

| Sent | Sender role | Sender | Internal note | Message |
|---|---|---|---|---|
| 2026-08-22 10:18 IST | CUSTOMER | customer2.baw@lbos.com | no | The bag had only one of the two cookie packs, the invoice shows two. |
| 2026-08-22 13:15 IST | SUPPORT_STAFF | support2@lbos.com | no | Thanks Rahul, I have verified the order items. I will refund the missing pack. |
| 2026-08-22 13:35 IST | SUPPORT_STAFF | support2@lbos.com | yes | Internal: retailer packed 1 of 2 units, refund of Rs 120.00 requested for approval. |

### TKT-2026-000003 - Mangoes were overripe on delivery

> The Banganapalli mangoes in my order were overripe and a few were already soft. Requesting a refund for them.

| Sent | Sender role | Sender | Internal note | Message |
|---|---|---|---|---|
| 2026-09-12 11:04 IST | CUSTOMER | customer3.hye@lbos.com | no | Some of the mangoes were already soft and dark when I opened the box. |
| 2026-09-12 12:30 IST | SUPPORT_STAFF | support1@lbos.com | no | Thanks Anjali. Could you share a photo so I can review the fruit quality? |
| 2026-09-12 13:30 IST | CUSTOMER | customer3.hye@lbos.com | no | Photo shared in the order chat. |
| 2026-09-13 16:25 IST | SUPPORT_STAFF | support1@lbos.com | no | The photos show fruit within normal ripeness for the season, so a refund is not possible here. Please reach out if you notice anything else. |

### TKT-2026-000004 - Order rejected by the shop after payment

> The shop rejected my order this morning but the amount I paid is still held. When will I get my money back?

| Sent | Sender role | Sender | Internal note | Message |
|---|---|---|---|---|
| 2026-09-20 12:14 IST | CUSTOMER | customer5.chs@lbos.com | no | The shop rejected my order but the payment is still on hold. How long will the refund take? |
| 2026-09-20 13:00 IST | SYSTEM | support1@lbos.com | yes | Ticket escalated to the retailer for this order: The shop must confirm the stock position and the refund timeline for this rejected order |
| 2026-09-20 13:05 IST | SUPPORT_STAFF | support1@lbos.com | no | Hi Sneha, I can see the payment is held in escrow. I have asked the shop to confirm and I have requested the refund. |

### TKT-2026-000005 - Delivery partner has not picked up my order

> A vehicle was assigned nearly an hour ago but nobody has come to the shop yet. Deliveries in our area seem to be delayed.

| Sent | Sender role | Sender | Internal note | Message |
|---|---|---|---|---|
| 2026-09-20 17:33 IST | CUSTOMER | customer6.baw@lbos.com | no | Vehicle assigned nearly an hour ago but nobody has arrived at the shop. |
| 2026-09-20 17:50 IST | SUPPORT_STAFF | support2@lbos.com | yes | Internal: three late-delivery tickets from West within two hours - checking the fleet situation with the Location Manager. |

### TKT-2026-000006 - Order still waiting for a delivery partner

> My order has been at 'finding delivery partner' for almost an hour. Is there a problem with deliveries in West Bengaluru?

| Sent | Sender role | Sender | Internal note | Message |
|---|---|---|---|---|
| 2026-09-20 17:43 IST | CUSTOMER | customer2.baw@lbos.com | no | Still no delivery partner for my order. It has been almost an hour. |

### TKT-2026-000007 - Order arrived more than four hours late

> I placed my order at 6 pm and it was delivered after 10 pm. The delivery estimate of 30-60 minutes was far off.

| Sent | Sender role | Sender | Internal note | Message |
|---|---|---|---|---|
| 2026-09-19 22:44 IST | CUSTOMER | customer7.baw@lbos.com | no | The estimate said 30-60 minutes but the order came after four hours. |
| 2026-09-20 01:10 IST | SUPPORT_STAFF | support1@lbos.com | no | Sorry for the delay, Kavya. I am reviewing what happened and will update you shortly. |

### TKT-2026-000008 - Payout for a delivered order still pending

> The payout for the coffee and onion order delivered last week is still showing as pending. Please check the settlement.

| Sent | Sender role | Sender | Internal note | Message |
|---|---|---|---|---|
| 2026-09-15 10:50 IST | RETAILER | retailer2.baw@lbos.com | no | The payout for the detergent order delivered last week is still pending. |
| 2026-09-15 13:45 IST | SUPPORT_STAFF | support1@lbos.com | no | Thanks Prakash. The settlement is created and scheduled for the next payout run - it will show as completed within two days. |

### TKT-2026-000009 - Repair expense submitted but not approved

> The REPAIR expense we submitted for the Tata Ace three weeks ago has not been approved or rejected yet.

| Sent | Sender role | Sender | Internal note | Message |
|---|---|---|---|---|
| 2026-09-10 15:04 IST | FLEET_MANAGER | fleet1.baw@lbos.com | no | The REPAIR expense has been pending for three weeks now. |
| 2026-09-11 10:30 IST | SYSTEM | support2@lbos.com | yes | Ticket escalated to OPERATIONS_MANAGER: Expense approvals belong to the Operations Manager of the city |
| 2026-09-11 11:00 IST | SUPPORT_STAFF | support2@lbos.com | no | Approvals are handled by your Operations Manager - I have escalated this to them. |

### TKT-2026-000010 - Drop location pin was wrong on the trip

> The navigation pin for a delivery pointed to the next street. I lost ten minutes finding the correct apartment block.

| Sent | Sender role | Sender | Internal note | Message |
|---|---|---|---|---|
| 2026-09-05 13:09 IST | DRIVER | driver1fleet3.chn@lbos.com | no | The drop pin was one street away from the actual apartment block. |
| 2026-09-05 18:05 IST | SUPPORT_STAFF | support2@lbos.com | no | Thanks for reporting this, Murugan. The address pin has been corrected in the customer's profile. |

### TKT-2026-000011 - Cannot update the second delivery address

> When I try to edit my Bengaluru work address, the save button stays disabled. Please help me update the postal code.

| Sent | Sender role | Sender | Internal note | Message |
|---|---|---|---|---|
| 2026-09-20 09:01 IST | CUSTOMER | customer1.chn@lbos.com | no | The save button stays disabled when I edit the Bengaluru address postal code. |

## Ticket cluster incident (`ticket_cluster_incident`)

Three or more distinct raisers of the same category and sub-category in one zone within 48 hours form an ACTIVE incident (`TicketClusterServiceImpl`, `MIN_DISTINCT_RAISERS = 3`). T5, T6 and T7 are late-delivery complaints of three different customers of **West** Bengaluru raised within a day; the incident groups them and the three tickets point back to it through `cluster_incident_id`. The application's own scheduler re-evaluates incidents with the real clock: once the 48-hour window has passed it marks the incident RESOLVED, exactly as it would for a genuine cluster (the seeder never creates a second one).

| Category / sub-category | Zone | Territory key | Tickets | Distinct raisers | First seen | Last seen | Detected | Last evaluated | Status |
|---|---|---|---|---|---|---|---|---|---|
| ORDER_ISSUE / LATE_DELIVERY | West, Bengaluru | ZONE:8a518c4f-31de-4dc0-bee7-9528051ed18c | 3 | 3 | 2026-09-19 22:40 IST | 2026-09-20 17:40 IST | 2026-09-20 17:45 IST | 2026-09-20 17:50 IST | ACTIVE |

