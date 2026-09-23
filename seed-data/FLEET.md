# Fleet Owners, Drivers, Vehicles (S2 + S5)

> Generated from the seeded database by `seed-data/tools/GenerateSeedDocs.java`; every value below is what the database holds. Long identity ids (products, categories, orders) are the values of a fresh database; UUIDs are random per environment, so records are identified by business key.

Three fleet owners, **three drivers and four vehicles each**: two mini trucks and a light truck (four-wheelers) and **one bike (two-wheeler)**. Two drivers hold an ACTIVE assignment on a mini truck, the third driver on the bike; the light truck is free and the third driver's earlier assignment on it is kept as an ENDED row. Vehicle numbers follow the Indian format (state code, RTO number, series, four digits); driving licences are `<state><RTO><year><7 digits>`.

# Bengaluru Route Logistics

Email:
`fleet1.baw@lbos.com`

Password:
`Lbos@2026!`

State:
Karnataka

City:
Bengaluru

Zone:
West

| Field | Value |
|---|---|
| Owner | Ravi Kumar Naidu |
| Phone | 9880044001 |
| Profile status | VERIFIED |
| Owner status | ACTIVE |
| Supervising Operations Manager | op.ba@lbos.com |
| Bank details verified by | op.ba@lbos.com |

## Drivers

| Driver Name | Email | Password | Phone | Licence no. | Licence expiry | Status | Commission | Position (lat, long) | Verified by | Active vehicle |
|---|---|---|---|---|---|---|---|---|---|---|
| Harish Kumar | `driver1fleet1.baw@lbos.com` | `Lbos@2026!` | 9880066011 | KA0520190041256 | 2029-06-14 | ACTIVE | 78.00% | 12.98, 77.56 | lm1.baw@lbos.com | KA05JK4471 |
| Mahesh Babu | `driver2fleet1.baw@lbos.com` | `Lbos@2026!` | 9880066012 | KA0220200018834 | 2030-02-27 | ACTIVE | 80.00% | 12.97, 77.58 | lm1.baw@lbos.com | KA02MN8125 |
| Ganesh Naik | `driver3fleet1.baw@lbos.com` | `Lbos@2026!` | 9880066013 | KA0420180029947 | 2028-11-05 | ACTIVE | 75.00% | 12.96, 77.60 | lm1.baw@lbos.com | KA01EW3388 |

## Vehicles

| Brand | Model | Vehicle No. | Vehicle Type | Capacity | Model year | Status | Position (lat, long) | Updated by |
|---|---|---|---|---|---|---|---|---|
| Hero | Splendor Plus | KA01EW3388 | BIKE (two-wheeler) | 30.00 kg | 2023 | ACTIVE | 13.03, 77.59 | fleet1.baw@lbos.com |
| Mahindra | Jeeto | KA02MN8125 | MINI_TRUCK (four-wheeler) | 700.00 kg | 2021 | ACTIVE | 13.01, 77.57 | fleet1.baw@lbos.com |
| Eicher | Pro 2049 | KA04HT6093 | TRUCK (four-wheeler) | 2500.00 kg | 2020 | ACTIVE | 13.02, 77.58 | fleet1.baw@lbos.com |
| Tata | Ace Gold | KA05JK4471 | MINI_TRUCK (four-wheeler) | 750.00 kg | 2022 | ACTIVE | 13.00, 77.56 | fleet1.baw@lbos.com |

## Driver - vehicle assignments

| Driver | Vehicle | Status | Assigned at | Ended at | Cargo | Required type | Assigned by |
|---|---|---|---|---|---|---|---|
| driver1fleet1.baw@lbos.com | KA05JK4471 (MINI_TRUCK) | ACTIVE | 2026-07-30 09:00 IST | NULL | 500.00 kg | MINI_TRUCK | fleet1.baw@lbos.com |
| driver2fleet1.baw@lbos.com | KA02MN8125 (MINI_TRUCK) | ACTIVE | 2026-07-30 09:10 IST | NULL | 400.00 kg | MINI_TRUCK | fleet1.baw@lbos.com |
| driver3fleet1.baw@lbos.com | KA04HT6093 (TRUCK) | ENDED | 2026-07-30 09:20 IST | 2026-08-06 17:30 IST | 1500.00 kg | TRUCK | fleet1.baw@lbos.com |
| driver3fleet1.baw@lbos.com | KA01EW3388 (BIKE) | ACTIVE | 2026-08-07 09:00 IST | NULL | 25.00 kg | BIKE | fleet1.baw@lbos.com |

## Fleet expenses

| Type | Amount | Date | Status | Vehicle | Driver | Created by | Approved by | Proof file |
|---|---|---|---|---|---|---|---|---|
| REPAIR | Rs 3200.00 | 2026-08-31 | REJECTED | KA05JK4471 | NULL | fleet1.baw@lbos.com | op.ba@lbos.com | repair-receipt-2026-08-31.pdf |
| FUEL | Rs 2450.00 | 2026-09-08 | APPROVED | KA05JK4471 | driver1fleet1.baw@lbos.com | fleet1.baw@lbos.com | op.ba@lbos.com | fuel-receipt-2026-09-08.pdf |
| MAINTENANCE | Rs 8600.00 | 2026-09-11 | PENDING | KA04HT6093 | NULL | fleet1.baw@lbos.com | NULL | maintenance-receipt-2026-09-11.pdf |
| TOLL | Rs 380.00 | 2026-09-14 | APPROVED | KA02MN8125 | driver2fleet1.baw@lbos.com | fleet1.baw@lbos.com | op.ba@lbos.com | toll-receipt-2026-09-14.pdf |

# Chennai City Carriers

Email:
`fleet3.chn@lbos.com`

Password:
`Lbos@2026!`

State:
Tamil Nadu

City:
Chennai

Zone:
North

| Field | Value |
|---|---|
| Owner | Senthil Murugan |
| Phone | 9840044003 |
| Profile status | VERIFIED |
| Owner status | ACTIVE |
| Supervising Operations Manager | op.ch@lbos.com |
| Bank details verified by | op.ch@lbos.com |

## Drivers

| Driver Name | Email | Password | Phone | Licence no. | Licence expiry | Status | Commission | Position (lat, long) | Verified by | Active vehicle |
|---|---|---|---|---|---|---|---|---|---|---|
| Murugan Selvam | `driver1fleet3.chn@lbos.com` | `Lbos@2026!` | 9840066031 | TN0920180061024 | 2028-12-09 | ACTIVE | 80.00% | 13.10, 80.25 | lm1.chn@lbos.com | TN09BX5316 |
| Prakash Raj | `driver2fleet3.chn@lbos.com` | `Lbos@2026!` | 9840066032 | TN0220200035518 | 2030-05-16 | ACTIVE | 78.00% | 13.09, 80.27 | lm1.chn@lbos.com | TN02CK9942 |
| Arun Pandian | `driver3fleet3.chn@lbos.com` | `Lbos@2026!` | 9840066033 | TN0720190024463 | 2029-10-01 | ACTIVE | 76.00% | 13.08, 80.29 | lm1.chn@lbos.com | TN22DM4085 |

## Vehicles

| Brand | Model | Vehicle No. | Vehicle Type | Capacity | Model year | Status | Position (lat, long) | Updated by |
|---|---|---|---|---|---|---|---|---|
| Mahindra | Jeeto | TN02CK9942 | MINI_TRUCK (four-wheeler) | 700.00 kg | 2023 | ACTIVE | 13.13, 80.26 | fleet3.chn@lbos.com |
| Eicher | Pro 2049 | TN07AT6178 | TRUCK (four-wheeler) | 2500.00 kg | 2020 | ACTIVE | 13.14, 80.27 | fleet3.chn@lbos.com |
| Tata | Ace Gold | TN09BX5316 | MINI_TRUCK (four-wheeler) | 750.00 kg | 2022 | ACTIVE | 13.12, 80.25 | fleet3.chn@lbos.com |
| Honda | Shine 125 | TN22DM4085 | BIKE (two-wheeler) | 30.00 kg | 2022 | ACTIVE | 13.15, 80.28 | fleet3.chn@lbos.com |

## Driver - vehicle assignments

| Driver | Vehicle | Status | Assigned at | Ended at | Cargo | Required type | Assigned by |
|---|---|---|---|---|---|---|---|
| driver1fleet3.chn@lbos.com | TN09BX5316 (MINI_TRUCK) | ACTIVE | 2026-07-30 09:00 IST | NULL | 500.00 kg | MINI_TRUCK | fleet3.chn@lbos.com |
| driver2fleet3.chn@lbos.com | TN02CK9942 (MINI_TRUCK) | ACTIVE | 2026-07-30 09:10 IST | NULL | 400.00 kg | MINI_TRUCK | fleet3.chn@lbos.com |
| driver3fleet3.chn@lbos.com | TN07AT6178 (TRUCK) | ENDED | 2026-07-30 09:20 IST | 2026-08-06 17:30 IST | 1500.00 kg | TRUCK | fleet3.chn@lbos.com |
| driver3fleet3.chn@lbos.com | TN22DM4085 (BIKE) | ACTIVE | 2026-08-07 09:00 IST | NULL | 25.00 kg | BIKE | fleet3.chn@lbos.com |

## Fleet expenses

| Type | Amount | Date | Status | Vehicle | Driver | Created by | Approved by | Proof file |
|---|---|---|---|---|---|---|---|---|
| FUEL | Rs 2320.00 | 2026-09-09 | APPROVED | TN09BX5316 | driver1fleet3.chn@lbos.com | fleet3.chn@lbos.com | op.ch@lbos.com | fuel-receipt-2026-09-09.pdf |
| TOLL | Rs 260.00 | 2026-09-13 | APPROVED | TN02CK9942 | driver2fleet3.chn@lbos.com | fleet3.chn@lbos.com | op.ch@lbos.com | toll-receipt-2026-09-13.pdf |
| MAINTENANCE | Rs 6750.00 | 2026-09-16 | PENDING | TN07AT6178 | NULL | fleet3.chn@lbos.com | NULL | maintenance-receipt-2026-09-16.pdf |
| FUEL | Rs 540.00 | 2026-09-17 | PENDING | TN22DM4085 | driver3fleet3.chn@lbos.com | fleet3.chn@lbos.com | NULL | fuel-receipt-2026-09-17.pdf |

# Deccan Fleet Services

Email:
`fleet2.hye@lbos.com`

Password:
`Lbos@2026!`

State:
Telangana

City:
Hyderabad

Zone:
East

| Field | Value |
|---|---|
| Owner | Naveen Goud |
| Phone | 9848044002 |
| Profile status | VERIFIED |
| Owner status | ACTIVE |
| Supervising Operations Manager | op.hy@lbos.com |
| Bank details verified by | op.hy@lbos.com |

## Drivers

| Driver Name | Email | Password | Phone | Licence no. | Licence expiry | Status | Commission | Position (lat, long) | Verified by | Active vehicle |
|---|---|---|---|---|---|---|---|---|---|---|
| Anil Kumar Yadav | `driver1fleet2.hye@lbos.com` | `Lbos@2026!` | 9848066021 | TS0820190053871 | 2029-09-30 | ACTIVE | 80.00% | 17.40, 78.57 | lm1.hye@lbos.com | TS08UB2210 |
| Mohammed Irfan | `driver2fleet2.hye@lbos.com` | `Lbos@2026!` | 9848066022 | TS0920210012365 | 2031-03-18 | ACTIVE | 76.00% | 17.39, 78.59 | lm1.hye@lbos.com | TS09FQ7754 |
| Vamsi Krishna | `driver3fleet2.hye@lbos.com` | `Lbos@2026!` | 9848066023 | TS0720200047719 | 2030-07-22 | ACTIVE | 78.00% | 17.38, 78.61 | lm1.hye@lbos.com | TS10ER5602 |

## Vehicles

| Brand | Model | Vehicle No. | Vehicle Type | Capacity | Model year | Status | Position (lat, long) | Updated by |
|---|---|---|---|---|---|---|---|---|
| Eicher | Pro 2049 | TS07JH1149 | TRUCK (four-wheeler) | 2500.00 kg | 2019 | ACTIVE | 17.44, 78.59 | fleet2.hye@lbos.com |
| Tata | Ace Gold | TS08UB2210 | MINI_TRUCK (four-wheeler) | 750.00 kg | 2022 | ACTIVE | 17.42, 78.57 | fleet2.hye@lbos.com |
| Ashok Leyland | Dost | TS09FQ7754 | MINI_TRUCK (four-wheeler) | 1250.00 kg | 2021 | ACTIVE | 17.43, 78.58 | fleet2.hye@lbos.com |
| Honda | Shine 125 | TS10ER5602 | BIKE (two-wheeler) | 30.00 kg | 2023 | ACTIVE | 17.45, 78.60 | fleet2.hye@lbos.com |

## Driver - vehicle assignments

| Driver | Vehicle | Status | Assigned at | Ended at | Cargo | Required type | Assigned by |
|---|---|---|---|---|---|---|---|
| driver1fleet2.hye@lbos.com | TS08UB2210 (MINI_TRUCK) | ACTIVE | 2026-07-30 09:00 IST | NULL | 500.00 kg | MINI_TRUCK | fleet2.hye@lbos.com |
| driver2fleet2.hye@lbos.com | TS09FQ7754 (MINI_TRUCK) | ACTIVE | 2026-07-30 09:10 IST | NULL | 400.00 kg | MINI_TRUCK | fleet2.hye@lbos.com |
| driver3fleet2.hye@lbos.com | TS07JH1149 (TRUCK) | ENDED | 2026-07-30 09:20 IST | 2026-08-06 17:30 IST | 1500.00 kg | TRUCK | fleet2.hye@lbos.com |
| driver3fleet2.hye@lbos.com | TS10ER5602 (BIKE) | ACTIVE | 2026-08-07 09:00 IST | NULL | 25.00 kg | BIKE | fleet2.hye@lbos.com |

## Fleet expenses

| Type | Amount | Date | Status | Vehicle | Driver | Created by | Approved by | Proof file |
|---|---|---|---|---|---|---|---|---|
| DRIVER_ALLOWANCE | Rs 1500.00 | 2026-09-04 | CANCELLED | TS10ER5602 | driver3fleet2.hye@lbos.com | fleet2.hye@lbos.com | NULL | driver-allowance-receipt-2026-09-04.pdf |
| FUEL | Rs 2875.00 | 2026-09-06 | APPROVED | TS08UB2210 | driver1fleet2.hye@lbos.com | fleet2.hye@lbos.com | op.hy@lbos.com | fuel-receipt-2026-09-06.pdf |
| PARKING | Rs 220.00 | 2026-09-12 | APPROVED | TS09FQ7754 | driver2fleet2.hye@lbos.com | fleet2.hye@lbos.com | op.hy@lbos.com | parking-receipt-2026-09-12.pdf |
| INSURANCE | Rs 9400.00 | 2026-09-15 | PENDING | TS07JH1149 | NULL | fleet2.hye@lbos.com | NULL | insurance-receipt-2026-09-15.pdf |

