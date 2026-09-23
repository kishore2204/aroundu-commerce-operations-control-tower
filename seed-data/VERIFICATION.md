# Verification (S2)

> Generated from the seeded database by `seed-data/tools/GenerateSeedDocs.java`; every value below is what the database holds. Long identity ids (products, categories, orders) are the values of a fresh database; UUIDs are random per environment, so records are identified by business key.

Every retailer, fleet owner, driver and vehicle has an APPROVED verification queue (29), reviewed by the Location Manager of its zone, with the documents its subject type requires (`VerificationQueueServiceImpl.requiredDocumentTypes`): retailer 4 (`GST_CERTIFICATE`, `PAN_CARD`, `BUSINESS_LICENSE`, `ADDRESS_PROOF`), fleet owner 2 (`GST_NUMBER`, `PAN_CARD`), driver 1 (`DRIVING_LICENSE`), vehicle 1 (`INSURANCE`). Each document is a small, structurally valid PDF stating that it is synthetic development data (no real personal document, no real number). An APPROVED queue is closed (`is_active = false`); its subject's own status (retailer `VERIFIED`, fleet owner `VERIFIED` + `ACTIVE`, driver / vehicle `ACTIVE`) is the result of the approval. Southern Spice Market shows the full document history: its first business-licence upload was REJECTED (unreadable), the second was APPROVED - both versions are kept.

## Queues by subject

| Subject type | Status | Queues |
|---|---|---|
| DRIVER | APPROVED | 9 |
| FLEET_OWNER | APPROVED | 3 |
| RETAILER | APPROVED | 5 |
| VEHICLE | APPROVED | 12 |

## Queues and documents

| Subject type | Subject | Zone | Submitted by | Reviewed by | Queue | Document | Document status | File | Expiry | Reviewed at |
|---|---|---|---|---|---|---|---|---|---|---|
| DRIVER | driver2fleet1.baw@lbos.com | West | fleet1.baw@lbos.com | lm1.baw@lbos.com | APPROVED | DRIVING_LICENSE v1 | APPROVED | driving-license-v1.pdf (495 bytes) | 2030-02-27 | 2026-07-25 14:20 IST |
| DRIVER | driver3fleet1.baw@lbos.com | West | fleet1.baw@lbos.com | lm1.baw@lbos.com | APPROVED | DRIVING_LICENSE v1 | APPROVED | driving-license-v1.pdf (495 bytes) | 2028-11-05 | 2026-07-26 14:20 IST |
| DRIVER | driver3fleet2.hye@lbos.com | East | fleet2.hye@lbos.com | lm1.hye@lbos.com | APPROVED | DRIVING_LICENSE v1 | APPROVED | driving-license-v1.pdf (495 bytes) | 2030-07-22 | 2026-07-26 14:20 IST |
| DRIVER | driver2fleet3.chn@lbos.com | North | fleet3.chn@lbos.com | lm1.chn@lbos.com | APPROVED | DRIVING_LICENSE v1 | APPROVED | driving-license-v1.pdf (495 bytes) | 2030-05-16 | 2026-07-26 14:20 IST |
| DRIVER | driver1fleet1.baw@lbos.com | West | fleet1.baw@lbos.com | lm1.baw@lbos.com | APPROVED | DRIVING_LICENSE v1 | APPROVED | driving-license-v1.pdf (495 bytes) | 2029-06-14 | 2026-07-27 14:20 IST |
| DRIVER | driver1fleet2.hye@lbos.com | East | fleet2.hye@lbos.com | lm1.hye@lbos.com | APPROVED | DRIVING_LICENSE v1 | APPROVED | driving-license-v1.pdf (495 bytes) | 2029-09-30 | 2026-07-27 14:20 IST |
| DRIVER | driver3fleet3.chn@lbos.com | North | fleet3.chn@lbos.com | lm1.chn@lbos.com | APPROVED | DRIVING_LICENSE v1 | APPROVED | driving-license-v1.pdf (495 bytes) | 2029-10-01 | 2026-07-27 14:20 IST |
| DRIVER | driver1fleet3.chn@lbos.com | North | fleet3.chn@lbos.com | lm1.chn@lbos.com | APPROVED | DRIVING_LICENSE v1 | APPROVED | driving-license-v1.pdf (495 bytes) | 2028-12-09 | 2026-07-28 14:20 IST |
| DRIVER | driver2fleet2.hye@lbos.com | East | fleet2.hye@lbos.com | lm1.hye@lbos.com | APPROVED | DRIVING_LICENSE v1 | APPROVED | driving-license-v1.pdf (495 bytes) | 2031-03-18 | 2026-07-28 14:20 IST |
| FLEET_OWNER | Bengaluru Route Logistics | West | fleet1.baw@lbos.com | lm1.baw@lbos.com | APPROVED | GST_NUMBER v1 | APPROVED | gst-number-v1.pdf (484 bytes) | NULL | 2026-07-14 16:00 IST |
| FLEET_OWNER | Bengaluru Route Logistics | West | fleet1.baw@lbos.com | lm1.baw@lbos.com | APPROVED | PAN_CARD v1 | APPROVED | pan-card-v1.pdf (482 bytes) | NULL | 2026-07-14 16:00 IST |
| FLEET_OWNER | Chennai City Carriers | North | fleet3.chn@lbos.com | lm1.chn@lbos.com | APPROVED | GST_NUMBER v1 | APPROVED | gst-number-v1.pdf (480 bytes) | NULL | 2026-07-15 16:00 IST |
| FLEET_OWNER | Deccan Fleet Services | East | fleet2.hye@lbos.com | lm1.hye@lbos.com | APPROVED | GST_NUMBER v1 | APPROVED | gst-number-v1.pdf (480 bytes) | NULL | 2026-07-15 16:00 IST |
| FLEET_OWNER | Chennai City Carriers | North | fleet3.chn@lbos.com | lm1.chn@lbos.com | APPROVED | PAN_CARD v1 | APPROVED | pan-card-v1.pdf (478 bytes) | NULL | 2026-07-15 16:00 IST |
| FLEET_OWNER | Deccan Fleet Services | East | fleet2.hye@lbos.com | lm1.hye@lbos.com | APPROVED | PAN_CARD v1 | APPROVED | pan-card-v1.pdf (478 bytes) | NULL | 2026-07-15 16:00 IST |
| RETAILER | Chennai Fresh Basket | North | retailer1.chn@lbos.com | lm1.chn@lbos.com | APPROVED | ADDRESS_PROOF v1 | APPROVED | address-proof-v1.pdf (482 bytes) | NULL | 2026-07-11 15:30 IST |
| RETAILER | Chennai Fresh Basket | North | retailer1.chn@lbos.com | lm1.chn@lbos.com | APPROVED | BUSINESS_LICENSE v1 | APPROVED | business-license-v1.pdf (485 bytes) | 2028-03-31 | 2026-07-11 15:30 IST |
| RETAILER | Chennai Fresh Basket | North | retailer1.chn@lbos.com | lm1.chn@lbos.com | APPROVED | GST_CERTIFICATE v1 | APPROVED | gst-certificate-v1.pdf (484 bytes) | NULL | 2026-07-11 15:30 IST |
| RETAILER | Chennai Fresh Basket | North | retailer1.chn@lbos.com | lm1.chn@lbos.com | APPROVED | PAN_CARD v1 | APPROVED | pan-card-v1.pdf (477 bytes) | NULL | 2026-07-11 15:30 IST |
| RETAILER | Bengaluru Daily Mart | West | retailer2.baw@lbos.com | lm1.baw@lbos.com | APPROVED | ADDRESS_PROOF v1 | APPROVED | address-proof-v1.pdf (482 bytes) | NULL | 2026-07-12 15:30 IST |
| RETAILER | Bengaluru Daily Mart | West | retailer2.baw@lbos.com | lm1.baw@lbos.com | APPROVED | BUSINESS_LICENSE v1 | APPROVED | business-license-v1.pdf (485 bytes) | 2028-03-31 | 2026-07-12 15:30 IST |
| RETAILER | Bengaluru Daily Mart | West | retailer2.baw@lbos.com | lm1.baw@lbos.com | APPROVED | GST_CERTIFICATE v1 | APPROVED | gst-certificate-v1.pdf (484 bytes) | NULL | 2026-07-12 15:30 IST |
| RETAILER | Bengaluru Daily Mart | West | retailer2.baw@lbos.com | lm1.baw@lbos.com | APPROVED | PAN_CARD v1 | APPROVED | pan-card-v1.pdf (477 bytes) | NULL | 2026-07-12 15:30 IST |
| RETAILER | Hyderabad Harvest Store | East | retailer3.hye@lbos.com | lm1.hye@lbos.com | APPROVED | ADDRESS_PROOF v1 | APPROVED | address-proof-v1.pdf (485 bytes) | NULL | 2026-07-13 15:30 IST |
| RETAILER | Hyderabad Harvest Store | East | retailer3.hye@lbos.com | lm1.hye@lbos.com | APPROVED | BUSINESS_LICENSE v1 | APPROVED | business-license-v1.pdf (488 bytes) | 2028-03-31 | 2026-07-13 15:30 IST |
| RETAILER | Hyderabad Harvest Store | East | retailer3.hye@lbos.com | lm1.hye@lbos.com | APPROVED | GST_CERTIFICATE v1 | APPROVED | gst-certificate-v1.pdf (487 bytes) | NULL | 2026-07-13 15:30 IST |
| RETAILER | Hyderabad Harvest Store | East | retailer3.hye@lbos.com | lm1.hye@lbos.com | APPROVED | PAN_CARD v1 | APPROVED | pan-card-v1.pdf (480 bytes) | NULL | 2026-07-13 15:30 IST |
| RETAILER | Southern Spice Market | South | retailer4.chs@lbos.com | lm2.chn@lbos.com | APPROVED | ADDRESS_PROOF v1 | APPROVED | address-proof-v1.pdf (483 bytes) | NULL | 2026-07-16 15:30 IST |
| RETAILER | Southern Spice Market | South | retailer4.chs@lbos.com | lm2.chn@lbos.com | APPROVED | BUSINESS_LICENSE v1 (superseded) | REJECTED | business-license-v1.pdf (486 bytes) | 2028-03-31 | 2026-07-14 17:45 IST |
| RETAILER | Southern Spice Market | South | retailer4.chs@lbos.com | lm2.chn@lbos.com | APPROVED | BUSINESS_LICENSE v2 | APPROVED | business-license-v2.pdf (486 bytes) | 2028-03-31 | 2026-07-16 15:30 IST |
| RETAILER | Southern Spice Market | South | retailer4.chs@lbos.com | lm2.chn@lbos.com | APPROVED | GST_CERTIFICATE v1 | APPROVED | gst-certificate-v1.pdf (485 bytes) | NULL | 2026-07-16 15:30 IST |
| RETAILER | Southern Spice Market | South | retailer4.chs@lbos.com | lm2.chn@lbos.com | APPROVED | PAN_CARD v1 | APPROVED | pan-card-v1.pdf (478 bytes) | NULL | 2026-07-16 15:30 IST |
| RETAILER | Perambur Daily Needs | North | retailer5.chn@lbos.com | lm1.chn@lbos.com | APPROVED | ADDRESS_PROOF v1 | APPROVED | address-proof-v1.pdf (482 bytes) | NULL | 2026-07-18 15:30 IST |
| RETAILER | Perambur Daily Needs | North | retailer5.chn@lbos.com | lm1.chn@lbos.com | APPROVED | BUSINESS_LICENSE v1 | APPROVED | business-license-v1.pdf (485 bytes) | 2028-03-31 | 2026-07-18 15:30 IST |
| RETAILER | Perambur Daily Needs | North | retailer5.chn@lbos.com | lm1.chn@lbos.com | APPROVED | GST_CERTIFICATE v1 | APPROVED | gst-certificate-v1.pdf (484 bytes) | NULL | 2026-07-18 15:30 IST |
| RETAILER | Perambur Daily Needs | North | retailer5.chn@lbos.com | lm1.chn@lbos.com | APPROVED | PAN_CARD v1 | APPROVED | pan-card-v1.pdf (477 bytes) | NULL | 2026-07-18 15:30 IST |
| VEHICLE | KA01EW3388 | West | fleet1.baw@lbos.com | lm1.baw@lbos.com | APPROVED | INSURANCE v1 | APPROVED | insurance-v1.pdf (485 bytes) | 2027-02-28 | 2026-07-23 13:10 IST |
| VEHICLE | TS07JH1149 | East | fleet2.hye@lbos.com | lm1.hye@lbos.com | APPROVED | INSURANCE v1 | APPROVED | insurance-v1.pdf (485 bytes) | 2027-02-28 | 2026-07-24 13:10 IST |
| VEHICLE | KA02MN8125 | West | fleet1.baw@lbos.com | lm1.baw@lbos.com | APPROVED | INSURANCE v1 | APPROVED | insurance-v1.pdf (485 bytes) | 2027-03-28 | 2026-07-24 13:10 IST |
| VEHICLE | TN02CK9942 | North | fleet3.chn@lbos.com | lm1.chn@lbos.com | APPROVED | INSURANCE v1 | APPROVED | insurance-v1.pdf (485 bytes) | 2027-02-28 | 2026-07-24 13:10 IST |
| VEHICLE | KA04HT6093 | West | fleet1.baw@lbos.com | lm1.baw@lbos.com | APPROVED | INSURANCE v1 | APPROVED | insurance-v1.pdf (485 bytes) | 2027-04-28 | 2026-07-25 13:10 IST |
| VEHICLE | TN07AT6178 | North | fleet3.chn@lbos.com | lm1.chn@lbos.com | APPROVED | INSURANCE v1 | APPROVED | insurance-v1.pdf (485 bytes) | 2027-03-28 | 2026-07-25 13:10 IST |
| VEHICLE | TS08UB2210 | East | fleet2.hye@lbos.com | lm1.hye@lbos.com | APPROVED | INSURANCE v1 | APPROVED | insurance-v1.pdf (485 bytes) | 2027-03-28 | 2026-07-25 13:10 IST |
| VEHICLE | TS09FQ7754 | East | fleet2.hye@lbos.com | lm1.hye@lbos.com | APPROVED | INSURANCE v1 | APPROVED | insurance-v1.pdf (485 bytes) | 2027-04-28 | 2026-07-26 13:10 IST |
| VEHICLE | KA05JK4471 | West | fleet1.baw@lbos.com | lm1.baw@lbos.com | APPROVED | INSURANCE v1 | APPROVED | insurance-v1.pdf (485 bytes) | 2027-05-28 | 2026-07-26 13:10 IST |
| VEHICLE | TN09BX5316 | North | fleet3.chn@lbos.com | lm1.chn@lbos.com | APPROVED | INSURANCE v1 | APPROVED | insurance-v1.pdf (485 bytes) | 2027-04-28 | 2026-07-26 13:10 IST |
| VEHICLE | TN22DM4085 | North | fleet3.chn@lbos.com | lm1.chn@lbos.com | APPROVED | INSURANCE v1 | APPROVED | insurance-v1.pdf (485 bytes) | 2027-05-28 | 2026-07-27 13:10 IST |
| VEHICLE | TS10ER5602 | East | fleet2.hye@lbos.com | lm1.hye@lbos.com | APPROVED | INSURANCE v1 | APPROVED | insurance-v1.pdf (485 bytes) | 2027-05-28 | 2026-07-27 13:10 IST |

