# Users, Managers and Territory (S1)

> Generated from the seeded database by `seed-data/tools/GenerateSeedDocs.java`; every value below is what the database holds. Long identity ids (products, categories, orders) are the values of a fresh database; UUIDs are random per environment, so records are identified by business key.

## Territory

Three states, three cities and **exactly four zones** - North, South, West and East.

| State | Country | City | Zone | Active |
|---|---|---|---|---|
| Karnataka | IN | Bengaluru | West | yes |
| Tamil Nadu | IN | Chennai | South | yes |
| Tamil Nadu | IN | Chennai | North | yes |
| Telangana | IN | Hyderabad | East | yes |

| Zone | City / State | Who works there |
|---|---|---|
| North | Chennai / Tamil Nadu | lm1.chn, Chennai Fresh Basket, Perambur Daily Needs, Chennai City Carriers |
| South | Chennai / Tamil Nadu | lm2.chn, Southern Spice Market |
| West | Bengaluru / Karnataka | lm1.baw, Bengaluru Daily Mart, Bengaluru Route Logistics |
| East | Hyderabad / Telangana | lm1.hye, Hyderabad Harvest Store, Deccan Fleet Services |

## User accounts (`user_account`, 34)

| Role | Name | Email | Phone | Status | Created | Password changed | Last login | Terms accepted |
|---|---|---|---|---|---|---|---|---|
| CUSTOMER | Priya Ramanathan | customer1.chn@lbos.com | 9840055001 | ACTIVE | 2026-07-27 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:18 IST | 2026-07-27 10:17 IST |
| CUSTOMER | Rahul Deshpande | customer2.baw@lbos.com | 9880055002 | ACTIVE | 2026-07-28 10:15 IST | 2026-09-20 22:19 IST | 2026-09-21 22:19 IST | 2026-07-28 10:17 IST |
| CUSTOMER | Anjali Reddy | customer3.hye@lbos.com | 9848055003 | ACTIVE | 2026-08-01 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | 2026-08-01 10:17 IST |
| CUSTOMER | Vignesh Kannan | customer4.chn@lbos.com | 9840055004 | ACTIVE | 2026-08-03 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | 2026-08-03 10:17 IST |
| CUSTOMER | Sneha Raghavan | customer5.chs@lbos.com | 9840055005 | ACTIVE | 2026-08-06 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | 2026-08-06 10:17 IST |
| CUSTOMER | Aditya Hegde | customer6.baw@lbos.com | 9880055006 | ACTIVE | 2026-08-09 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | 2026-08-09 10:17 IST |
| CUSTOMER | Kavya Bhat | customer7.baw@lbos.com | 9880055007 | ACTIVE | 2026-08-11 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | 2026-08-11 10:17 IST |
| DRIVER | Harish Kumar | driver1fleet1.baw@lbos.com | 9880066011 | ACTIVE | 2026-07-22 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | NULL |
| DRIVER | Anil Kumar Yadav | driver1fleet2.hye@lbos.com | 9848066021 | ACTIVE | 2026-07-22 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | NULL |
| DRIVER | Murugan Selvam | driver1fleet3.chn@lbos.com | 9840066031 | ACTIVE | 2026-07-21 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:18 IST | NULL |
| DRIVER | Mahesh Babu | driver2fleet1.baw@lbos.com | 9880066012 | ACTIVE | 2026-07-22 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | NULL |
| DRIVER | Mohammed Irfan | driver2fleet2.hye@lbos.com | 9848066022 | ACTIVE | 2026-07-23 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | NULL |
| DRIVER | Prakash Raj | driver2fleet3.chn@lbos.com | 9840066032 | ACTIVE | 2026-07-21 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | NULL |
| DRIVER | Ganesh Naik | driver3fleet1.baw@lbos.com | 9880066013 | ACTIVE | 2026-07-24 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | NULL |
| DRIVER | Vamsi Krishna | driver3fleet2.hye@lbos.com | 9848066023 | ACTIVE | 2026-07-25 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | NULL |
| DRIVER | Arun Pandian | driver3fleet3.chn@lbos.com | 9840066033 | ACTIVE | 2026-07-23 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | NULL |
| FLEET_MANAGER | Ravi Kumar Naidu | fleet1.baw@lbos.com | 9880044001 | ACTIVE | 2026-07-10 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | 2026-07-10 10:17 IST |
| FLEET_MANAGER | Naveen Goud | fleet2.hye@lbos.com | 9848044002 | ACTIVE | 2026-07-11 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | 2026-07-11 10:17 IST |
| FLEET_MANAGER | Senthil Murugan | fleet3.chn@lbos.com | 9840044003 | ACTIVE | 2026-07-11 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | 2026-07-11 10:17 IST |
| LOCATION_MANAGER | Manjunath Gowda | lm1.baw@lbos.com | 9880022003 | ACTIVE | 2026-06-22 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | NULL |
| LOCATION_MANAGER | Karthik Subramanian | lm1.chn@lbos.com | 9840022001 | ACTIVE | 2026-07-02 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | NULL |
| LOCATION_MANAGER | Venkatesh Rao | lm1.hye@lbos.com | 9848022004 | ACTIVE | 2026-06-22 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | NULL |
| LOCATION_MANAGER | Divya Ramesh | lm2.chn@lbos.com | 9840022002 | ACTIVE | 2026-06-17 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | NULL |
| OPERATIONS_MANAGER | Lakshmi Narayanan | op.ba@lbos.com | 9880011002 | ACTIVE | 2026-06-12 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | NULL |
| OPERATIONS_MANAGER | Suresh Venkataraman | op.ch@lbos.com | 9840011001 | ACTIVE | 2026-06-12 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | NULL |
| OPERATIONS_MANAGER | Srinivas Reddy | op.hy@lbos.com | 9848011003 | ACTIVE | 2026-06-12 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | NULL |
| RETAILER | Arjun Balasubramanian | retailer1.chn@lbos.com | 9840033001 | ACTIVE | 2026-07-07 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:18 IST | 2026-07-07 10:17 IST |
| RETAILER | Prakash Shetty | retailer2.baw@lbos.com | 9880033002 | ACTIVE | 2026-07-08 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | 2026-07-08 10:17 IST |
| RETAILER | Sravani Chowdary | retailer3.hye@lbos.com | 9848033003 | ACTIVE | 2026-07-09 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | 2026-07-09 10:17 IST |
| RETAILER | Ramya Iyer | retailer4.chs@lbos.com | 9840033004 | ACTIVE | 2026-07-12 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | 2026-07-12 10:17 IST |
| RETAILER | Mohammed Faizal | retailer5.chn@lbos.com | 9840033005 | ACTIVE | 2026-07-14 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | 2026-07-14 10:17 IST |
| SUPER_ADMIN | Rohan Mehta | admin@lbos.com | 9810000001 | ACTIVE | 2026-05-23 10:15 IST | 2026-09-20 22:19 IST | 2026-09-21 22:19 IST | NULL |
| SUPPORT_STAFF | Ananya Krishnan | support1@lbos.com | 9810000002 | ACTIVE | 2026-06-02 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | NULL |
| SUPPORT_STAFF | Imran Sheikh | support2@lbos.com | 9810000003 | ACTIVE | 2026-06-02 10:15 IST | 2026-09-07 22:15 IST | 2026-09-21 22:16 IST | NULL |

Self-registered roles (customers, retailers, fleet owners) accepted the Terms & Conditions two minutes after creating the account; accounts created by an administrator, an Operations Manager or a fleet owner (staff, managers, drivers) carry no terms date. Phone numbers are exactly 10 digits and unique.

## Operations Managers (`operations_manager`)

| Name | Email | City | State | Assignment | Assigned at | Updated at | Version |
|---|---|---|---|---|---|---|---|
| Lakshmi Narayanan | op.ba@lbos.com | Bengaluru | Karnataka | ACTIVE | 2026-06-14 11:00 IST | 2026-06-14 11:00 IST | 0 |
| Suresh Venkataraman | op.ch@lbos.com | Chennai | Tamil Nadu | ACTIVE | 2026-06-14 11:00 IST | 2026-06-14 11:00 IST | 0 |
| Srinivas Reddy | op.hy@lbos.com | Hyderabad | Telangana | ACTIVE | 2026-06-14 11:00 IST | 2026-06-14 11:00 IST | 0 |

## Location Managers (`location_manager`)

| Name | Email | Zone | City | Supervising Operations Manager | Assignment | Assigned at |
|---|---|---|---|---|---|---|
| Manjunath Gowda | lm1.baw@lbos.com | West | Bengaluru | op.ba@lbos.com | ACTIVE | 2026-06-24 11:30 IST |
| Karthik Subramanian | lm1.chn@lbos.com | North | Chennai | op.ch@lbos.com | ACTIVE | 2026-07-10 11:30 IST |
| Divya Ramesh | lm2.chn@lbos.com | South | Chennai | op.ch@lbos.com | ACTIVE | 2026-07-08 11:30 IST |
| Venkatesh Rao | lm1.hye@lbos.com | East | Hyderabad | op.hy@lbos.com | ACTIVE | 2026-06-24 11:30 IST |

## Location Manager transfer history (`location_manager_assignment_history`)

| Location Manager | From | From assigned at | To | Moved at |
|---|---|---|---|---|
| lm2.chn@lbos.com | North / Chennai | 2026-06-17 11:30 IST | South / Chennai | 2026-07-08 11:30 IST |

`lm2.chn` started as the North officer and moved to South when `lm1.chn` was hired for North, which is the row `PUT /api/v1/location-managers/{id}/transfer` leaves behind.

`password_reset_token` is intentionally not seeded: a token is a short-lived (30 minute) secret created by the forgot-password flow, so a seeded one would only be an expired row.
