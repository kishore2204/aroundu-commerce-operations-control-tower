# Products and Tax (S3 + S6)

> Generated from the seeded database by `seed-data/tools/GenerateSeedDocs.java`; every value below is what the database holds. Long identity ids (products, categories, orders) are the values of a fresh database; UUIDs are random per environment, so records are identified by business key.

## How tax is linked in the current project

```text
Retailer
   ↓ owns
Product (S3 products.category_id)
   ↓ belongs to
Product Category (S3 product_categories)
   ↓ referenced BY ID from S6 (no foreign key, no copy of the category table)
TaxConfiguration (S6 tax_configuration.product_category_id)
   ↓ one active rule per category and state
State (S1 state)  ←  the state of the customer's delivery city
   ↓
CGST % + SGST %  (effective from / to, active)
```

At checkout S3 sends S6 one tax item per cart line - `productId`, `productCategoryId`, `quantity`, `unitPrice` - per retailer; S6 resolves the delivery city's state (from S1), loads the active rules of the basket's categories in that state in one query, taxes **each line with its own category's rate** (`quantity x price x (CGST + SGST) / 100`, rounded per line to 2 decimals) and rejects the basket if a category has no applicable rule - there is no default rate (`TaxCalculationService`). The order stores the tax it was charged, so later rate changes never touch it.

## Tax configuration (`tax_configuration`)

| Category id | Category | State | CGST | SGST | Total GST | Effective from | Effective to | Active |
|---|---|---|---|---|---|---|---|---|
| 1 | Fresh Produce | Karnataka | 0.00% | 0.00% | 0.00% | 2024-04-01 | NULL | yes |
| 1 | Fresh Produce | Tamil Nadu | 0.00% | 0.00% | 0.00% | 2024-04-01 | NULL | yes |
| 1 | Fresh Produce | Telangana | 0.00% | 0.00% | 0.00% | 2024-04-01 | NULL | yes |
| 2 | Groceries & Staples | Karnataka | 2.50% | 2.50% | 5.00% | 2024-04-01 | NULL | yes |
| 2 | Groceries & Staples | Tamil Nadu | 2.50% | 2.50% | 5.00% | 2024-04-01 | NULL | yes |
| 2 | Groceries & Staples | Telangana | 2.50% | 2.50% | 5.00% | 2024-04-01 | NULL | yes |
| 3 | Dairy & Bakery | Karnataka | 2.50% | 2.50% | 5.00% | 2024-04-01 | NULL | yes |
| 3 | Dairy & Bakery | Tamil Nadu | 2.50% | 2.50% | 5.00% | 2024-04-01 | NULL | yes |
| 3 | Dairy & Bakery | Telangana | 2.50% | 2.50% | 5.00% | 2024-04-01 | NULL | yes |
| 4 | Beverages | Karnataka | 6.00% | 6.00% | 12.00% | 2024-04-01 | NULL | yes |
| 4 | Beverages | Tamil Nadu | 9.00% | 9.00% | 18.00% | 2022-04-01 | 2024-03-31 | no |
| 4 | Beverages | Tamil Nadu | 6.00% | 6.00% | 12.00% | 2024-04-01 | NULL | yes |
| 4 | Beverages | Telangana | 6.00% | 6.00% | 12.00% | 2024-04-01 | NULL | yes |
| 5 | Packaged Foods | Karnataka | 6.00% | 6.00% | 12.00% | 2024-04-01 | NULL | yes |
| 5 | Packaged Foods | Tamil Nadu | 6.00% | 6.00% | 12.00% | 2024-04-01 | NULL | yes |
| 5 | Packaged Foods | Telangana | 6.00% | 6.00% | 12.00% | 2024-04-01 | NULL | yes |
| 6 | Household Essentials | Karnataka | 9.00% | 9.00% | 18.00% | 2024-04-01 | NULL | yes |
| 6 | Household Essentials | Tamil Nadu | 9.00% | 9.00% | 18.00% | 2024-04-01 | NULL | yes |
| 6 | Household Essentials | Telangana | 9.00% | 9.00% | 18.00% | 2024-04-01 | NULL | yes |
| 7 | Personal Care | Karnataka | 9.00% | 9.00% | 18.00% | 2024-04-01 | NULL | yes |
| 7 | Personal Care | Tamil Nadu | 9.00% | 9.00% | 18.00% | 2024-04-01 | NULL | yes |
| 7 | Personal Care | Telangana | 9.00% | 9.00% | 18.00% | 2024-04-01 | NULL | yes |
| 8 | Electronics | Karnataka | 9.00% | 9.00% | 18.00% | 2024-04-01 | NULL | yes |
| 8 | Electronics | Tamil Nadu | 9.00% | 9.00% | 18.00% | 2024-04-01 | NULL | yes |
| 8 | Electronics | Telangana | 9.00% | 9.00% | 18.00% | 2024-04-01 | NULL | yes |

Every ACTIVE category has one ACTIVE rule in each of the three states (24 active rules); the closed, inactive Tamil Nadu Beverages row (9% + 9% until 2024-03-31) is history and never applies. `Festive Gifting` (INACTIVE) has no rule. `taxCategoryName` holds the category's name as the display snapshot.

## Product -> category -> tax

| Retailer | SKU | Product | Category | Tamil Nadu | Karnataka | Telangana |
|---|---|---|---|---|---|---|
| Bengaluru Daily Mart | FRV-ONION-2KG | Nashik Onions 2kg | Fresh Produce | 0.00% | 0.00% | 0.00% |
| Bengaluru Daily Mart | GRO-ATTA-5KG | Whole Wheat Atta 5kg | Groceries & Staples | 5.00% | 5.00% | 5.00% |
| Bengaluru Daily Mart | GRO-SUGAR-1KG | Refined Sugar 1kg | Groceries & Staples | 5.00% | 5.00% | 5.00% |
| Bengaluru Daily Mart | BEV-COFFEE-200 | Filter Coffee Powder 200g | Beverages | 12.00% | 12.00% | 12.00% |
| Bengaluru Daily Mart | PKG-BISCUIT-6PK | Butter Cookies Family Pack 6x60g | Packaged Foods | 12.00% | 12.00% | 12.00% |
| Bengaluru Daily Mart | HHE-DETERGENT-1KG | Detergent Powder 1kg | Household Essentials | 18.00% | 18.00% | 18.00% |
| Chennai Fresh Basket | FRV-TOMATO-1KG | Farm Fresh Tomatoes 1kg | Fresh Produce | 0.00% | 0.00% | 0.00% |
| Chennai Fresh Basket | FRV-BANANA-12 | Robusta Bananas (12 pcs) | Fresh Produce | 0.00% | 0.00% | 0.00% |
| Chennai Fresh Basket | GRO-SONAMASURI-5 | Sona Masoori Rice 5kg | Groceries & Staples | 5.00% | 5.00% | 5.00% |
| Chennai Fresh Basket | GRO-TOORDAL-1KG | Toor Dal 1kg | Groceries & Staples | 5.00% | 5.00% | 5.00% |
| Chennai Fresh Basket | DAI-MILK-500 | Full Cream Milk 500ml | Dairy & Bakery | 5.00% | 5.00% | 5.00% |
| Chennai Fresh Basket | HHE-DISHWASH-500 | Lemon Dishwash Liquid 500ml | Household Essentials | 18.00% | 18.00% | 18.00% |
| Hyderabad Harvest Store | FRV-MANGO-1KG | Banganapalli Mangoes 1kg | Fresh Produce | 0.00% | 0.00% | 0.00% |
| Hyderabad Harvest Store | GRO-BASMATI-5KG | Long Grain Basmati Rice 5kg | Groceries & Staples | 5.00% | 5.00% | 5.00% |
| Hyderabad Harvest Store | GRO-OIL-1L | Refined Sunflower Oil 1L | Groceries & Staples | 5.00% | 5.00% | 5.00% |
| Hyderabad Harvest Store | DAI-PANEER-200 | Fresh Paneer 200g | Dairy & Bakery | 5.00% | 5.00% | 5.00% |
| Hyderabad Harvest Store | BEV-TEA-500 | Assam CTC Tea 500g | Beverages | 12.00% | 12.00% | 12.00% |
| Hyderabad Harvest Store | PCR-SHAMPOO-340 | Herbal Anti-Dandruff Shampoo 340ml | Personal Care | 18.00% | 18.00% | 18.00% |
| Perambur Daily Needs | DAI-CURD-400 | Fresh Set Curd 400g | Dairy & Bakery | 5.00% | 5.00% | 5.00% |
| Perambur Daily Needs | DAI-BREAD-400 | Whole Wheat Sandwich Bread 400g | Dairy & Bakery | 5.00% | 5.00% | 5.00% |
| Perambur Daily Needs | BEV-JUICE-1L | Mixed Fruit Juice 1L | Beverages | 12.00% | 12.00% | 12.00% |
| Perambur Daily Needs | PKG-NOODLES-4PK | Masala Instant Noodles 4-Pack | Packaged Foods | 12.00% | 12.00% | 12.00% |
| Perambur Daily Needs | PCR-SOAP-4PK | Sandalwood Bath Soap 4-Pack | Personal Care | 18.00% | 18.00% | 18.00% |
| Perambur Daily Needs | ELC-LEDBULB-9W | 9W LED Bulb Cool Daylight | Electronics | 18.00% | 18.00% | 18.00% |
| Southern Spice Market | GRO-SAMBAR-200 | Sambar Powder 200g | Groceries & Staples | 5.00% | 5.00% | 5.00% |
| Southern Spice Market | GRO-TAMARIND-500 | Seedless Tamarind 500g | Groceries & Staples | 5.00% | 5.00% | 5.00% |
| Southern Spice Market | PKG-PAPAD-200 | Appalam Papad 200g | Packaged Foods | 12.00% | 12.00% | 12.00% |
| Southern Spice Market | BEV-BUTTERMILK-6PK | Spiced Buttermilk 200ml x6 | Beverages | 12.00% | 12.00% | 12.00% |
| Southern Spice Market | ELC-POWERBANK-10K | 10000mAh Power Bank | Electronics | 18.00% | 18.00% | 18.00% |
| Southern Spice Market | HHE-FLOORCLEAN-1L | Floor Cleaner Pine Fragrance 1L | Household Essentials | 18.00% | 18.00% | 18.00% |

## Tax charged on the seeded orders

For every order the state is the state of the delivery address' city; each line uses the active rule of the product's category in that state.

| Order | Delivery state | Lines: SKU (category rate) = tax | Order tax |
|---|---|---|---|
| ORD-1787319300000-1 | Tamil Nadu | GRO-TOORDAL-1KG (Groceries & Staples 5.00%) = 16.50; HHE-DISHWASH-500 (Household Essentials 18.00%) = 17.82 | 34.32 |
| ORD-1786427400000-1 | Karnataka | FRV-ONION-2KG (Fresh Produce 0.00%) = 0.00; GRO-ATTA-5KG (Groceries & Staples 5.00%) = 13.25; GRO-SUGAR-1KG (Groceries & Staples 5.00%) = 4.60 | 17.85 |
| ORD-1786623300000-1 | Telangana | GRO-BASMATI-5KG (Groceries & Staples 5.00%) = 31.00; GRO-OIL-1L (Groceries & Staples 5.00%) = 15.50; BEV-TEA-500 (Beverages 12.00%) = 28.80 | 75.30 |
| ORD-1787286000000-1 | Karnataka | BEV-COFFEE-200 (Beverages 12.00%) = 22.20; PKG-BISCUIT-6PK (Packaged Foods 12.00%) = 28.80 | 51.00 |
| ORD-1787490000000-1 | Tamil Nadu | GRO-SAMBAR-200 (Groceries & Staples 5.00%) = 9.20; PKG-PAPAD-200 (Packaged Foods 12.00%) = 19.80; BEV-BUTTERMILK-6PK (Beverages 12.00%) = 20.16 | 49.16 |
| ORD-1788702000000-1 | Tamil Nadu | FRV-TOMATO-1KG (Fresh Produce 0.00%) = 0.00; GRO-SONAMASURI-5 (Groceries & Staples 5.00%) = 17.45; DAI-MILK-500 (Dairy & Bakery 5.00%) = 3.00 | 20.45 |
| ORD-1788702000000-2 | Tamil Nadu | DAI-CURD-400 (Dairy & Bakery 5.00%) = 4.00; DAI-BREAD-400 (Dairy & Bakery 5.00%) = 4.50; BEV-JUICE-1L (Beverages 12.00%) = 13.20 | 21.70 |
| ORD-1788174600000-1 | Karnataka | HHE-DETERGENT-1KG (Household Essentials 18.00%) = 24.30; GRO-ATTA-5KG (Groceries & Staples 5.00%) = 13.25 | 37.55 |
| ORD-1788331500000-1 | Karnataka | BEV-COFFEE-200 (Beverages 12.00%) = 44.40; PKG-BISCUIT-6PK (Packaged Foods 12.00%) = 43.20 | 87.60 |
| ORD-1788532500000-1 | Tamil Nadu | PKG-NOODLES-4PK (Packaged Foods 12.00%) = 24.48; PCR-SOAP-4PK (Personal Care 18.00%) = 50.40; ELC-LEDBULB-9W (Electronics 18.00%) = 32.04 | 106.92 |
| ORD-1789026900000-1 | Karnataka | HHE-DETERGENT-1KG (Household Essentials 18.00%) = 24.30; PKG-BISCUIT-6PK (Packaged Foods 12.00%) = 14.40 | 38.70 |
| ORD-1789129800000-1 | Telangana | PCR-SHAMPOO-340 (Personal Care 18.00%) = 44.10; FRV-MANGO-1KG (Fresh Produce 0.00%) = 0.00; DAI-PANEER-200 (Dairy & Bakery 5.00%) = 4.75 | 48.85 |
| ORD-1789293900000-1 | Tamil Nadu | ELC-POWERBANK-10K (Electronics 18.00%) = 161.82 | 161.82 |
| ORD-1789393800000-1 | Karnataka | BEV-COFFEE-200 (Beverages 12.00%) = 22.20; FRV-ONION-2KG (Fresh Produce 0.00%) = 0.00; PKG-BISCUIT-6PK (Packaged Foods 12.00%) = 14.40 | 36.60 |
| ORD-1789903800000-1 | Tamil Nadu | DAI-MILK-500 (Dairy & Bakery 5.00%) = 4.50; HHE-DISHWASH-500 (Household Essentials 18.00%) = 17.82 | 22.32 |
| ORD-1789903800000-2 | Tamil Nadu | BEV-JUICE-1L (Beverages 12.00%) = 26.40; PKG-NOODLES-4PK (Packaged Foods 12.00%) = 16.32; ELC-LEDBULB-9W (Electronics 18.00%) = 16.02 | 58.74 |
| ORD-1789902600000-1 | Karnataka | GRO-ATTA-5KG (Groceries & Staples 5.00%) = 13.25; GRO-SUGAR-1KG (Groceries & Staples 5.00%) = 2.30 | 15.55 |
| ORD-1789884000000-1 | Tamil Nadu | GRO-SAMBAR-200 (Groceries & Staples 5.00%) = 4.60; GRO-TAMARIND-500 (Groceries & Staples 5.00%) = 8.80 | 13.40 |
| ORD-1789792500000-1 | Telangana | FRV-MANGO-1KG (Fresh Produce 0.00%) = 0.00 | 0.00 |
| ORD-1789821300000-1 | Karnataka | PKG-BISCUIT-6PK (Packaged Foods 12.00%) = 28.80; FRV-ONION-2KG (Fresh Produce 0.00%) = 0.00 | 28.80 |
| ORD-1789903500000-2 | Karnataka | GRO-SUGAR-1KG (Groceries & Staples 5.00%) = 4.60; BEV-COFFEE-200 (Beverages 12.00%) = 22.20 | 26.80 |

