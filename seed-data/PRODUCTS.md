# Products (S3)

> Generated from the seeded database by `seed-data/tools/GenerateSeedDocs.java`; every value below is what the database holds. Long identity ids (products, categories, orders) are the values of a fresh database; UUIDs are random per environment, so records are identified by business key.

Thirty products, six per retailer, every one in a real category. `Stock now` is the opening stock less what the seeded, non-cancelled orders ordered (S4 deducts stock exactly as `InventoryClient.deductStock` does); the low-stock threshold and weight are the values the retailer would enter in the catalogue. One product (`HHE-FLOORCLEAN-1L`) is a DRAFT: not yet on sale. `PKG-BISCUIT-6PK` carries the `TRENDING` quality flag because it has five reviews averaging 4.8 (ReviewServiceImpl rule).

## Bengaluru Daily Mart

| Id | SKU | Product | Category | Description | Unit price | Opening stock | Stock now | Low-stock threshold | Weight | Status | Quality flag | Listed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | FRV-ONION-2KG | Nashik Onions 2kg | Fresh Produce | Hand-sorted Nashik onions with dry skins and a good shelf life, 2 kg bag. | Rs 64.00 | 140 | 134 | 30 | 2.000 kg | ACTIVE | NULL | 2026-07-23 11:00 IST |
| 14 | GRO-ATTA-5KG | Whole Wheat Atta 5kg | Groceries & Staples | Stone-ground whole wheat atta for soft rotis and chapatis, 5 kg pack. | Rs 265.00 | 70 | 67 | 15 | 5.000 kg | ACTIVE | NULL | 2026-07-29 11:00 IST |
| 15 | GRO-SUGAR-1KG | Refined Sugar 1kg | Groceries & Staples | Free-flowing refined white sugar in a sealed 1 kg pack. | Rs 46.00 | 150 | 145 | 30 | 1.000 kg | ACTIVE | NULL | 2026-07-29 11:00 IST |
| 16 | BEV-COFFEE-200 | Filter Coffee Powder 200g | Beverages | Freshly roasted 80:20 coffee-chicory filter coffee powder, 200 g pack. | Rs 185.00 | 60 | 55 | 12 | 0.220 kg | ACTIVE | NULL | 2026-07-27 11:00 IST |
| 17 | PKG-BISCUIT-6PK | Butter Cookies Family Pack 6x60g | Packaged Foods | Six 60 g packs of crisp butter cookies - a family pack for tea time. | Rs 120.00 | 100 | 91 | 20 | 0.400 kg | ACTIVE | TRENDING | 2026-07-28 11:00 IST |
| 18 | HHE-DETERGENT-1KG | Detergent Powder 1kg | Household Essentials | Machine and hand wash detergent powder with a fresh fragrance, 1 kg pack. | Rs 135.00 | 80 | 78 | 15 | 1.020 kg | ACTIVE | NULL | 2026-07-26 11:00 IST |

## Chennai Fresh Basket

| Id | SKU | Product | Category | Description | Unit price | Opening stock | Stock now | Low-stock threshold | Weight | Status | Quality flag | Listed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | FRV-TOMATO-1KG | Farm Fresh Tomatoes 1kg | Fresh Produce | Firm, ripe red tomatoes picked the same morning, ideal for curries, chutneys and salads. | Rs 38.00 | 120 | 117 | 25 | 1.000 kg | ACTIVE | NULL | 2026-07-25 11:00 IST |
| 2 | FRV-BANANA-12 | Robusta Bananas (12 pcs) | Fresh Produce | A dozen naturally ripened robusta bananas, sweet and evenly yellow. | Rs 52.00 | 90 | 90 | 20 | 1.200 kg | ACTIVE | NULL | 2026-07-26 11:00 IST |
| 3 | GRO-SONAMASURI-5 | Sona Masoori Rice 5kg | Groceries & Staples | Lightweight, aged sona masoori rice that cooks fluffy - a daily staple for South Indian meals. | Rs 349.00 | 60 | 59 | 15 | 5.000 kg | ACTIVE | NULL | 2026-07-31 11:00 IST |
| 4 | GRO-TOORDAL-1KG | Toor Dal 1kg | Groceries & Staples | Polished, unoiled toor dal that cooks quickly and evenly for sambar and dal. | Rs 165.00 | 80 | 78 | 20 | 1.000 kg | ACTIVE | NULL | 2026-07-22 11:00 IST |
| 5 | DAI-MILK-500 | Full Cream Milk 500ml | Dairy & Bakery | Pasteurised full cream milk in a 500 ml pouch, delivered chilled. | Rs 30.00 | 200 | 195 | 40 | 0.520 kg | ACTIVE | NULL | 2026-07-28 11:00 IST |
| 6 | HHE-DISHWASH-500 | Lemon Dishwash Liquid 500ml | Household Essentials | Grease-cutting lemon dishwash liquid that is gentle on hands and rinses clean. | Rs 99.00 | 70 | 68 | 15 | 0.550 kg | ACTIVE | NULL | 2026-07-27 11:00 IST |

## Hyderabad Harvest Store

| Id | SKU | Product | Category | Description | Unit price | Opening stock | Stock now | Low-stock threshold | Weight | Status | Quality flag | Listed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 19 | FRV-MANGO-1KG | Banganapalli Mangoes 1kg | Fresh Produce | Sweet, fibre-free Banganapalli mangoes ripened naturally, sold per kilogram. | Rs 120.00 | 60 | 58 | 15 | 1.000 kg | ACTIVE | NULL | 2026-07-23 11:00 IST |
| 20 | GRO-BASMATI-5KG | Long Grain Basmati Rice 5kg | Groceries & Staples | Aged extra-long grain basmati rice that stays fluffy - ideal for biryani and pulao. | Rs 620.00 | 45 | 44 | 10 | 5.000 kg | ACTIVE | NULL | 2026-07-24 11:00 IST |
| 21 | GRO-OIL-1L | Refined Sunflower Oil 1L | Groceries & Staples | Light, refined sunflower oil in a 1 litre pouch for everyday cooking. | Rs 155.00 | 90 | 88 | 20 | 0.920 kg | ACTIVE | NULL | 2026-07-25 11:00 IST |
| 22 | DAI-PANEER-200 | Fresh Paneer 200g | Dairy & Bakery | Soft, fresh paneer block made from full cream milk, 200 g vacuum pack. | Rs 95.00 | 50 | 49 | 12 | 0.210 kg | ACTIVE | NULL | 2026-07-29 11:00 IST |
| 23 | BEV-TEA-500 | Assam CTC Tea 500g | Beverages | Strong, aromatic Assam CTC tea leaves in a 500 g resealable pack. | Rs 240.00 | 70 | 69 | 15 | 0.520 kg | ACTIVE | NULL | 2026-07-28 11:00 IST |
| 24 | PCR-SHAMPOO-340 | Herbal Anti-Dandruff Shampoo 340ml | Personal Care | Herbal anti-dandruff shampoo with neem and tea tree extracts, 340 ml bottle. | Rs 245.00 | 65 | 64 | 12 | 0.380 kg | ACTIVE | NULL | 2026-07-23 11:00 IST |

## Perambur Daily Needs

| Id | SKU | Product | Category | Description | Unit price | Opening stock | Stock now | Low-stock threshold | Weight | Status | Quality flag | Listed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 7 | DAI-CURD-400 | Fresh Set Curd 400g | Dairy & Bakery | Thick, creamy set curd made daily, packed in a 400 g cup. | Rs 40.00 | 100 | 98 | 20 | 0.420 kg | ACTIVE | NULL | 2026-07-30 11:00 IST |
| 8 | DAI-BREAD-400 | Whole Wheat Sandwich Bread 400g | Dairy & Bakery | Soft whole wheat sandwich bread, baked fresh each morning, 400 g loaf. | Rs 45.00 | 80 | 78 | 15 | 0.400 kg | ACTIVE | NULL | 2026-07-28 11:00 IST |
| 9 | BEV-JUICE-1L | Mixed Fruit Juice 1L | Beverages | Ready-to-drink mixed fruit juice in a 1 litre carton with no added colour. | Rs 110.00 | 60 | 57 | 12 | 1.050 kg | ACTIVE | NULL | 2026-07-26 11:00 IST |
| 10 | PKG-NOODLES-4PK | Masala Instant Noodles 4-Pack | Packaged Foods | Four-pack of masala instant noodles with a seasoning sachet, ready in three minutes. | Rs 68.00 | 150 | 145 | 30 | 0.350 kg | ACTIVE | NULL | 2026-07-31 11:00 IST |
| 11 | PCR-SOAP-4PK | Sandalwood Bath Soap 4-Pack | Personal Care | Pack of four sandalwood-scented bath soaps, 75 g each, mild on skin. | Rs 140.00 | 90 | 88 | 20 | 0.500 kg | ACTIVE | NULL | 2026-07-23 11:00 IST |
| 12 | ELC-LEDBULB-9W | 9W LED Bulb Cool Daylight | Electronics | Energy-saving 9 watt cool daylight LED bulb with a B22 cap and a two-year replacement warranty. | Rs 89.00 | 110 | 107 | 20 | 0.080 kg | ACTIVE | NULL | 2026-07-24 11:00 IST |

## Southern Spice Market

| Id | SKU | Product | Category | Description | Unit price | Opening stock | Stock now | Low-stock threshold | Weight | Status | Quality flag | Listed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 25 | GRO-SAMBAR-200 | Sambar Powder 200g | Groceries & Staples | Freshly ground sambar powder made with roasted coriander, dal and red chillies. | Rs 92.00 | 100 | 97 | 20 | 0.210 kg | ACTIVE | NULL | 2026-07-30 11:00 IST |
| 26 | GRO-TAMARIND-500 | Seedless Tamarind 500g | Groceries & Staples | Cleaned, seedless tamarind block with a rich sour taste, 500 g pack. | Rs 88.00 | 80 | 78 | 15 | 0.510 kg | ACTIVE | NULL | 2026-07-31 11:00 IST |
| 27 | PKG-PAPAD-200 | Appalam Papad 200g | Packaged Foods | Crisp urad dal appalam papads that puff up when fried, 200 g pack. | Rs 55.00 | 120 | 117 | 25 | 0.210 kg | ACTIVE | NULL | 2026-07-22 11:00 IST |
| 28 | BEV-BUTTERMILK-6PK | Spiced Buttermilk 200ml x6 | Beverages | Six 200 ml packs of ready-to-drink spiced buttermilk with curry leaf and ginger. | Rs 84.00 | 90 | 88 | 20 | 1.300 kg | ACTIVE | NULL | 2026-07-27 11:00 IST |
| 29 | ELC-POWERBANK-10K | 10000mAh Power Bank | Electronics | 10000 mAh power bank with dual USB output, fast charging and a battery level indicator. | Rs 899.00 | 40 | 39 | 8 | 0.250 kg | ACTIVE | NULL | 2026-07-31 11:00 IST |
| 30 | HHE-FLOORCLEAN-1L | Floor Cleaner Pine Fragrance 1L | Household Essentials | Disinfectant floor cleaner with a pine fragrance - listing being prepared, not yet on sale. | Rs 148.00 | 60 | 60 | 12 | 1.100 kg | DRAFT | NULL | 2026-07-29 11:00 IST |

