# Retailers (S2)

> Generated from the seeded database by `seed-data/tools/GenerateSeedDocs.java`; every value below is what the database holds. Long identity ids (products, categories, orders) are the values of a fresh database; UUIDs are random per environment, so records are identified by business key.

Five retailers, all `VERIFIED`: the three requested ones plus one in Chennai South (so a South customer can shop) and a second one in Chennai North (so a North customer can place a **multi-retailer** checkout). Each has an APPROVED verification queue reviewed by the Location Manager of its zone, with the four documents a retailer needs (`GST_CERTIFICATE`, `PAN_CARD`, `BUSINESS_LICENSE`, `ADDRESS_PROOF`).

## Bengaluru Daily Mart

| Field | Value |
|---|---|
| Login email | `retailer2.baw@lbos.com` |
| Password | `Lbos@2026!` |
| Owner | Prakash Shetty |
| Phone | 9880033002 |
| State / City / Zone | Karnataka / Bengaluru / West |
| Supervising Operations Manager | op.ba@lbos.com |
| Registration number | UDYAM-KA-03-0058213 |
| GSTIN | 29AAKFB7310P1ZT |
| Retailer status | VERIFIED |
| Shop open | yes |
| Opening hours | 00:00 - 23:59 (open all day, see SEED_DATA_README) |
| Location (lat, long) | 12.9915000, 77.5541000 |

**Verification** queue `APPROVED`, submitted 2026-07-09 12:00 IST, decided 2026-07-12 15:30 IST.

| Document | Version | Current | Status | File | Bytes | Expiry | Reviewer comment |
|---|---|---|---|---|---|---|---|
| ADDRESS_PROOF | 1 | yes | APPROVED | address-proof-v1.pdf | 482 | NULL | Verified against the original document |
| BUSINESS_LICENSE | 1 | yes | APPROVED | business-license-v1.pdf | 485 | 2028-03-31 | Verified against the original document |
| GST_CERTIFICATE | 1 | yes | APPROVED | gst-certificate-v1.pdf | 484 | NULL | Verified against the original document |
| PAN_CARD | 1 | yes | APPROVED | pan-card-v1.pdf | 477 | NULL | Verified against the original document |

Products: 6 - orders received: 9 (see PRODUCTS.md and ORDERS.md).

## Chennai Fresh Basket

| Field | Value |
|---|---|
| Login email | `retailer1.chn@lbos.com` |
| Password | `Lbos@2026!` |
| Owner | Arjun Balasubramanian |
| Phone | 9840033001 |
| State / City / Zone | Tamil Nadu / Chennai / North |
| Supervising Operations Manager | op.ch@lbos.com |
| Registration number | UDYAM-TN-02-0041867 |
| GSTIN | 33AAHFC4521M1ZP |
| Retailer status | VERIFIED |
| Shop open | yes |
| Opening hours | 00:00 - 23:59 (open all day, see SEED_DATA_README) |
| Location (lat, long) | 13.1114000, 80.2472000 |

**Verification** queue `APPROVED`, submitted 2026-07-08 12:00 IST, decided 2026-07-11 15:30 IST.

| Document | Version | Current | Status | File | Bytes | Expiry | Reviewer comment |
|---|---|---|---|---|---|---|---|
| ADDRESS_PROOF | 1 | yes | APPROVED | address-proof-v1.pdf | 482 | NULL | Verified against the original document |
| BUSINESS_LICENSE | 1 | yes | APPROVED | business-license-v1.pdf | 485 | 2028-03-31 | Verified against the original document |
| GST_CERTIFICATE | 1 | yes | APPROVED | gst-certificate-v1.pdf | 484 | NULL | Verified against the original document |
| PAN_CARD | 1 | yes | APPROVED | pan-card-v1.pdf | 477 | NULL | Verified against the original document |

Products: 6 - orders received: 3 (see PRODUCTS.md and ORDERS.md).

## Hyderabad Harvest Store

| Field | Value |
|---|---|
| Login email | `retailer3.hye@lbos.com` |
| Password | `Lbos@2026!` |
| Owner | Sravani Chowdary |
| Phone | 9848033003 |
| State / City / Zone | Telangana / Hyderabad / East |
| Supervising Operations Manager | op.hy@lbos.com |
| Registration number | UDYAM-TS-02-0033490 |
| GSTIN | 36AAJFH2764K1ZQ |
| Retailer status | VERIFIED |
| Shop open | yes |
| Opening hours | 00:00 - 23:59 (open all day, see SEED_DATA_README) |
| Location (lat, long) | 17.4062000, 78.5591000 |

**Verification** queue `APPROVED`, submitted 2026-07-10 12:00 IST, decided 2026-07-13 15:30 IST.

| Document | Version | Current | Status | File | Bytes | Expiry | Reviewer comment |
|---|---|---|---|---|---|---|---|
| ADDRESS_PROOF | 1 | yes | APPROVED | address-proof-v1.pdf | 485 | NULL | Verified against the original document |
| BUSINESS_LICENSE | 1 | yes | APPROVED | business-license-v1.pdf | 488 | 2028-03-31 | Verified against the original document |
| GST_CERTIFICATE | 1 | yes | APPROVED | gst-certificate-v1.pdf | 487 | NULL | Verified against the original document |
| PAN_CARD | 1 | yes | APPROVED | pan-card-v1.pdf | 480 | NULL | Verified against the original document |

Products: 6 - orders received: 3 (see PRODUCTS.md and ORDERS.md).

## Perambur Daily Needs

| Field | Value |
|---|---|
| Login email | `retailer5.chn@lbos.com` |
| Password | `Lbos@2026!` |
| Owner | Mohammed Faizal |
| Phone | 9840033005 |
| State / City / Zone | Tamil Nadu / Chennai / North |
| Supervising Operations Manager | op.ch@lbos.com |
| Registration number | UDYAM-TN-02-0060342 |
| GSTIN | 33AAJFP6653G1ZW |
| Retailer status | VERIFIED |
| Shop open | yes |
| Opening hours | 00:00 - 23:59 (open all day, see SEED_DATA_README) |
| Location (lat, long) | 13.1180000, 80.2440000 |

**Verification** queue `APPROVED`, submitted 2026-07-15 12:00 IST, decided 2026-07-18 15:30 IST.

| Document | Version | Current | Status | File | Bytes | Expiry | Reviewer comment |
|---|---|---|---|---|---|---|---|
| ADDRESS_PROOF | 1 | yes | APPROVED | address-proof-v1.pdf | 482 | NULL | Verified against the original document |
| BUSINESS_LICENSE | 1 | yes | APPROVED | business-license-v1.pdf | 485 | 2028-03-31 | Verified against the original document |
| GST_CERTIFICATE | 1 | yes | APPROVED | gst-certificate-v1.pdf | 484 | NULL | Verified against the original document |
| PAN_CARD | 1 | yes | APPROVED | pan-card-v1.pdf | 477 | NULL | Verified against the original document |

Products: 6 - orders received: 3 (see PRODUCTS.md and ORDERS.md).

## Southern Spice Market

| Field | Value |
|---|---|
| Login email | `retailer4.chs@lbos.com` |
| Password | `Lbos@2026!` |
| Owner | Ramya Iyer |
| Phone | 9840033004 |
| State / City / Zone | Tamil Nadu / Chennai / South |
| Supervising Operations Manager | op.ch@lbos.com |
| Registration number | UDYAM-TN-02-0052716 |
| GSTIN | 33AAKFS9184D1ZL |
| Retailer status | VERIFIED |
| Shop open | yes |
| Opening hours | 00:00 - 23:59 (open all day, see SEED_DATA_README) |
| Location (lat, long) | 12.9812000, 80.2409000 |

**Verification** queue `APPROVED`, submitted 2026-07-13 12:00 IST, decided 2026-07-16 15:30 IST.

| Document | Version | Current | Status | File | Bytes | Expiry | Reviewer comment |
|---|---|---|---|---|---|---|---|
| ADDRESS_PROOF | 1 | yes | APPROVED | address-proof-v1.pdf | 483 | NULL | Verified against the original document |
| BUSINESS_LICENSE | 1 | no | REJECTED | business-license-v1.pdf | 486 | 2028-03-31 | Rejected: The licence copy is cropped - the expiry date cannot be read. Please upload the full page. |
| BUSINESS_LICENSE | 2 | yes | APPROVED | business-license-v2.pdf | 486 | 2028-03-31 | Verified against the original licence |
| GST_CERTIFICATE | 1 | yes | APPROVED | gst-certificate-v1.pdf | 485 | NULL | Verified against the original document |
| PAN_CARD | 1 | yes | APPROVED | pan-card-v1.pdf | 478 | NULL | Verified against the original document |

Products: 6 - orders received: 3 (see PRODUCTS.md and ORDERS.md).

