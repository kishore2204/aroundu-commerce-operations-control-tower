# Notifications and Audit Log (S6)

> Generated from the seeded database by `seed-data/tools/GenerateSeedDocs.java`; every value below is what the database holds. Long identity ids (products, categories, orders) are the values of a fresh database; UUIDs are random per environment, so records are identified by business key.

## Notifications (`notifications`)

The notifications the application sends along an order's life (`OrderService`, `TripService`, `PaymentTransactionService`, `SupportTicketServiceImpl`): to the retailer when an order arrives (`ORDER_RECEIVED`), to the customer for payment (`PAYMENT`), acceptance / rejection / cancellation, pickup (`ORDER_PICKED_UP`) and delivery (`DELIVERED`), to the fleet owner for a delivery request (`DELIVERY_REQUEST`), and the ticket events (`SUPPORT_TICKET_ASSIGNED / RESOLVED / CLOSED / ESCALATED`). Notifications older than two days are `read`, newer ones unread.

| Recipient role | Type | Reference | Notifications | Read |
|---|---|---|---|---|
| CUSTOMER | DELIVERED | ORDER | 16 | 15 |
| CUSTOMER | ORDER_ACCEPTED | ORDER | 19 | 14 |
| CUSTOMER | ORDER_CANCELLED | ORDER | 1 | 0 |
| CUSTOMER | ORDER_PICKED_UP | ORDER | 17 | 15 |
| CUSTOMER | ORDER_REJECTED | ORDER | 1 | 0 |
| CUSTOMER | PAYMENT | ORDER | 22 | 15 |
| CUSTOMER | SUPPORT_TICKET_CLOSED | SUPPORT_TICKET | 1 | 1 |
| CUSTOMER | SUPPORT_TICKET_ESCALATED | SUPPORT_TICKET | 1 | 0 |
| CUSTOMER | SUPPORT_TICKET_RESOLVED | SUPPORT_TICKET | 3 | 3 |
| DRIVER | SUPPORT_TICKET_CLOSED | SUPPORT_TICKET | 1 | 1 |
| DRIVER | SUPPORT_TICKET_RESOLVED | SUPPORT_TICKET | 1 | 1 |
| FLEET_MANAGER | DELIVERY_REQUEST | ORDER | 18 | 15 |
| FLEET_MANAGER | SUPPORT_TICKET_ESCALATED | SUPPORT_TICKET | 1 | 1 |
| RETAILER | ORDER_RECEIVED | ORDER | 21 | 14 |
| RETAILER | SUPPORT_TICKET_RESOLVED | SUPPORT_TICKET | 1 | 1 |
| SUPPORT_STAFF | SUPPORT_TICKET_ASSIGNED | SUPPORT_TICKET | 10 | 6 |

Recent notifications of the seeded customers (sample):

| Recipient | Type | Title | Message | Read | Sent |
|---|---|---|---|---|---|
| customer4.chn@lbos.com | ORDER_PICKED_UP | Order picked up | Your order ORD-1789903800000-1 has been picked up and is on its way. | no | 2026-09-20 17:32 IST |
| customer4.chn@lbos.com | ORDER_ACCEPTED | Order accepted | The shop accepted your order ORD-1789903800000-1. | no | 2026-09-20 17:09 IST |
| customer4.chn@lbos.com | ORDER_ACCEPTED | Order accepted | The shop accepted your order ORD-1789903800000-2. | no | 2026-09-20 17:09 IST |
| customer2.baw@lbos.com | ORDER_ACCEPTED | Order accepted | The shop accepted your order ORD-1789903500000-2. | no | 2026-09-20 17:04 IST |
| customer4.chn@lbos.com | PAYMENT | Payment received | Your payment of Rs 561.64 for order ORD-1789903800000-2 was received. | no | 2026-09-20 17:03 IST |
| customer4.chn@lbos.com | PAYMENT | Payment received | Your payment of Rs 264.10 for order ORD-1789903800000-1 was received. | no | 2026-09-20 17:03 IST |
| customer2.baw@lbos.com | PAYMENT | Payment received | Your payment of Rs 358.34 for order ORD-1789903500000-2 was received. | no | 2026-09-20 16:58 IST |
| customer6.baw@lbos.com | ORDER_ACCEPTED | Order accepted | The shop accepted your order ORD-1789902600000-1. | no | 2026-09-20 16:49 IST |
| customer6.baw@lbos.com | PAYMENT | Payment received | Your payment of Rs 381.77 for order ORD-1789902600000-1 was received. | no | 2026-09-20 16:43 IST |
| customer6.baw@lbos.com | PAYMENT | Payment received | Your payment of Rs 184.00 for order LOG-1789900200000 was received. | no | 2026-09-20 16:03 IST |
| customer5.chs@lbos.com | SUPPORT_TICKET_ESCALATED | Your ticket has been escalated | Ticket TKT-2026-000004 (Order rejected by the shop after payment) has been escalated for further review. | no | 2026-09-20 13:00 IST |
| customer5.chs@lbos.com | ORDER_REJECTED | Order rejected | Your order was rejected by the shop. | no | 2026-09-20 11:36 IST |

## Audit log (`audit_log`)

In this application every audit row is written by the frontend's audit interceptor after an internal role performs a business action: `action` is the readable name, `source_module` the area, `new_values` the technical request (`{"status", "role", "request": "METHOD path"}`), `old_values` is always NULL and `ip_address` is filled here with internal addresses. All actors are real seeded staff accounts.

| Performed at | Actor | Action | Module | Details | IP |
|---|---|---|---|---|---|
| 2026-06-12 11:00 IST | admin@lbos.com | Create Tax Configuration | TAX CONFIGURATIONS | `{"status":200,"role":"SUPER_ADMIN","request":"POST /api/tax-configurations"}` | 10.23.14.29 |
| 2026-06-13 11:20 IST | admin@lbos.com | Create Tax Configuration | TAX CONFIGURATIONS | `{"status":200,"role":"SUPER_ADMIN","request":"POST /api/tax-configurations"}` | 10.23.14.30 |
| 2026-06-14 10:10 IST | admin@lbos.com | Update Tax Configuration | TAX CONFIGURATIONS | `{"status":200,"role":"SUPER_ADMIN","request":"PUT /api/tax-configurations"}` | 10.23.14.31 |
| 2026-07-08 11:30 IST | op.ch@lbos.com | Transfer Location Manager | LOCATION MANAGERS | `{"status":200,"role":"OPERATIONS_MANAGER","request":"PUT /api/v1/location-managers/transfer"}` | 10.23.14.20 |
| 2026-07-11 15:30 IST | lm1.chn@lbos.com | Approve Verification | VERIFICATION QUEUES | `{"status":200,"role":"LOCATION_MANAGER","request":"POST /api/v1/verification-queues/process-result"}` | 10.23.14.21 |
| 2026-07-12 15:30 IST | lm1.baw@lbos.com | Approve Verification | VERIFICATION QUEUES | `{"status":200,"role":"LOCATION_MANAGER","request":"POST /api/v1/verification-queues/process-result"}` | 10.23.14.22 |
| 2026-07-13 15:30 IST | lm1.hye@lbos.com | Approve Verification | VERIFICATION QUEUES | `{"status":200,"role":"LOCATION_MANAGER","request":"POST /api/v1/verification-queues/process-result"}` | 10.23.14.23 |
| 2026-07-14 16:00 IST | lm1.baw@lbos.com | Approve Verification | VERIFICATION QUEUES | `{"status":200,"role":"LOCATION_MANAGER","request":"POST /api/v1/verification-queues/process-result"}` | 10.23.14.27 |
| 2026-07-15 16:00 IST | lm1.hye@lbos.com | Approve Verification | VERIFICATION QUEUES | `{"status":200,"role":"LOCATION_MANAGER","request":"POST /api/v1/verification-queues/process-result"}` | 10.23.14.28 |
| 2026-07-15 16:00 IST | lm1.chn@lbos.com | Approve Verification | VERIFICATION QUEUES | `{"status":200,"role":"LOCATION_MANAGER","request":"POST /api/v1/verification-queues/process-result"}` | 10.23.14.26 |
| 2026-07-16 15:30 IST | lm2.chn@lbos.com | Approve Verification | VERIFICATION QUEUES | `{"status":200,"role":"LOCATION_MANAGER","request":"POST /api/v1/verification-queues/process-result"}` | 10.23.14.24 |
| 2026-07-18 15:30 IST | lm1.chn@lbos.com | Approve Verification | VERIFICATION QUEUES | `{"status":200,"role":"LOCATION_MANAGER","request":"POST /api/v1/verification-queues/process-result"}` | 10.23.14.25 |
| 2026-08-22 10:45 IST | support2@lbos.com | Assign Support Ticket | SUPPORT TICKETS | `{"status":200,"role":"SUPPORT_STAFF","request":"POST /api/support-tickets/assign"}` | 10.23.14.39 |
| 2026-08-23 15:00 IST | support2@lbos.com | Resolve Support Ticket | SUPPORT TICKETS | `{"status":200,"role":"SUPPORT_STAFF","request":"POST /api/support-tickets/resolve"}` | 10.23.14.40 |
| 2026-08-23 16:00 IST | admin@lbos.com | Approve Refund | REFUNDS | `{"status":200,"role":"SUPER_ADMIN","request":"POST /api/customer-refunds/approve"}` | 10.23.14.47 |
| 2026-08-26 17:00 IST | admin@lbos.com | Complete Settlement | SETTLEMENTS | `{"status":200,"role":"SUPER_ADMIN","request":"POST /api/settlements/complete"}` | 10.23.14.51 |
| 2026-08-31 17:00 IST | admin@lbos.com | Complete Settlement | SETTLEMENTS | `{"status":200,"role":"SUPER_ADMIN","request":"POST /api/settlements/complete"}` | 10.23.14.52 |
| 2026-09-01 14:05 IST | op.ba@lbos.com | Reject Expense | FLEET EXPENSES | `{"status":200,"role":"OPERATIONS_MANAGER","request":"PATCH /api/fleet-expenses/reject"}` | 10.23.14.35 |
| 2026-09-07 12:40 IST | op.hy@lbos.com | Approve Expense | FLEET EXPENSES | `{"status":200,"role":"OPERATIONS_MANAGER","request":"PATCH /api/fleet-expenses/approve"}` | 10.23.14.33 |
| 2026-09-08 17:00 IST | admin@lbos.com | Complete Settlement | SETTLEMENTS | `{"status":200,"role":"SUPER_ADMIN","request":"POST /api/settlements/complete"}` | 10.23.14.53 |
| 2026-09-09 12:10 IST | op.ba@lbos.com | Approve Expense | FLEET EXPENSES | `{"status":200,"role":"OPERATIONS_MANAGER","request":"PATCH /api/fleet-expenses/approve"}` | 10.23.14.32 |
| 2026-09-10 12:15 IST | op.ch@lbos.com | Approve Expense | FLEET EXPENSES | `{"status":200,"role":"OPERATIONS_MANAGER","request":"PATCH /api/fleet-expenses/approve"}` | 10.23.14.34 |
| 2026-09-11 10:30 IST | support2@lbos.com | Escalate Support Ticket | SUPPORT TICKETS | `{"status":200,"role":"SUPPORT_STAFF","request":"POST /api/support-tickets/escalate"}` | 10.23.14.46 |
| 2026-09-12 11:30 IST | support1@lbos.com | Assign Support Ticket | SUPPORT TICKETS | `{"status":200,"role":"SUPPORT_STAFF","request":"POST /api/support-tickets/assign"}` | 10.23.14.41 |
| 2026-09-13 16:30 IST | support1@lbos.com | Resolve Support Ticket | SUPPORT TICKETS | `{"status":200,"role":"SUPPORT_STAFF","request":"POST /api/support-tickets/resolve"}` | 10.23.14.42 |
| 2026-09-13 16:30 IST | admin@lbos.com | Reject Refund | REFUNDS | `{"status":200,"role":"SUPER_ADMIN","request":"POST /api/customer-refunds/reject"}` | 10.23.14.50 |
| 2026-09-14 10:00 IST | support1@lbos.com | Assign Support Ticket | SUPPORT TICKETS | `{"status":200,"role":"SUPPORT_STAFF","request":"POST /api/support-tickets/assign"}` | 10.23.14.36 |
| 2026-09-15 12:00 IST | support1@lbos.com | Resolve Support Ticket | SUPPORT TICKETS | `{"status":200,"role":"SUPPORT_STAFF","request":"POST /api/support-tickets/resolve"}` | 10.23.14.37 |
| 2026-09-15 12:20 IST | admin@lbos.com | Approve Refund | REFUNDS | `{"status":200,"role":"SUPER_ADMIN","request":"POST /api/customer-refunds/approve"}` | 10.23.14.48 |
| 2026-09-15 12:30 IST | admin@lbos.com | Complete Refund | REFUNDS | `{"status":200,"role":"SUPER_ADMIN","request":"POST /api/customer-refunds/complete"}` | 10.23.14.49 |
| 2026-09-16 12:00 IST | support1@lbos.com | Close Support Ticket | SUPPORT TICKETS | `{"status":200,"role":"SUPPORT_STAFF","request":"POST /api/support-tickets/close"}` | 10.23.14.38 |
| 2026-09-20 12:40 IST | support1@lbos.com | Assign Support Ticket | SUPPORT TICKETS | `{"status":200,"role":"SUPPORT_STAFF","request":"POST /api/support-tickets/assign"}` | 10.23.14.43 |
| 2026-09-20 13:00 IST | support1@lbos.com | Escalate Support Ticket | SUPPORT TICKETS | `{"status":200,"role":"SUPPORT_STAFF","request":"POST /api/support-tickets/escalate"}` | 10.23.14.44 |
| 2026-09-20 17:35 IST | support2@lbos.com | Assign Support Ticket | SUPPORT TICKETS | `{"status":200,"role":"SUPPORT_STAFF","request":"POST /api/support-tickets/assign"}` | 10.23.14.45 |

