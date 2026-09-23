# Carts and Wishlists (S3)

> Generated from the seeded database by `seed-data/tools/GenerateSeedDocs.java`; every value below is what the database holds. Long identity ids (products, categories, orders) are the values of a fresh database; UUIDs are random per environment, so records are identified by business key.

A cart line is a `customer_cart` row (customer + product, unique per pair) with its `customer_cart_item` (retailer, quantity, status, note). Customers 1 and 4 hold **multi-retailer carts** (two Chennai North shops: checkout will split them into one order per retailer, exactly like the seeded orders O6/O7 and O15/O16); customers 2, 3 and 5 hold single-retailer carts; customers 6 and 7 have no cart.

## Carts

| Customer | Retailer | SKU | Product | Qty | Unit price | Line total | Status | Note | Added |
|---|---|---|---|---|---|---|---|---|---|
| customer1.chn@lbos.com | Chennai Fresh Basket | DAI-MILK-500 | Full Cream Milk 500ml | 2 | Rs 30.00 | Rs 60.00 | ACTIVE | Morning delivery preferred | 2026-09-19 19:30 IST |
| customer1.chn@lbos.com | Chennai Fresh Basket | FRV-BANANA-12 | Robusta Bananas (12 pcs) | 2 | Rs 52.00 | Rs 104.00 | ACTIVE | Needed for the weekend | 2026-09-19 19:30 IST |
| customer1.chn@lbos.com | Perambur Daily Needs | DAI-CURD-400 | Fresh Set Curd 400g | 1 | Rs 40.00 | Rs 40.00 | ACTIVE | Added from the product page | 2026-09-19 19:30 IST |
| customer1.chn@lbos.com | Perambur Daily Needs | PKG-NOODLES-4PK | Masala Instant Noodles 4-Pack | 2 | Rs 68.00 | Rs 136.00 | ACTIVE | Added from the product page | 2026-09-19 19:30 IST |
| customer2.baw@lbos.com | Bengaluru Daily Mart | BEV-COFFEE-200 | Filter Coffee Powder 200g | 1 | Rs 185.00 | Rs 185.00 | ACTIVE | Added from the product page | 2026-09-18 19:30 IST |
| customer2.baw@lbos.com | Bengaluru Daily Mart | HHE-DETERGENT-1KG | Detergent Powder 1kg | 1 | Rs 135.00 | Rs 135.00 | ACTIVE | Refill for the laundry | 2026-09-18 19:30 IST |
| customer3.hye@lbos.com | Hyderabad Harvest Store | DAI-PANEER-200 | Fresh Paneer 200g | 1 | Rs 95.00 | Rs 95.00 | ACTIVE | Added from the product page | 2026-09-20 19:30 IST |
| customer3.hye@lbos.com | Hyderabad Harvest Store | FRV-MANGO-1KG | Banganapalli Mangoes 1kg | 2 | Rs 120.00 | Rs 240.00 | ACTIVE | Added from the wishlist | 2026-09-20 19:30 IST |
| customer4.chn@lbos.com | Chennai Fresh Basket | GRO-SONAMASURI-5 | Sona Masoori Rice 5kg | 1 | Rs 349.00 | Rs 349.00 | ACTIVE | Added from the product page | 2026-09-19 19:30 IST |
| customer4.chn@lbos.com | Perambur Daily Needs | DAI-BREAD-400 | Whole Wheat Sandwich Bread 400g | 2 | Rs 45.00 | Rs 90.00 | ACTIVE | Added from the product page | 2026-09-19 19:30 IST |
| customer5.chs@lbos.com | Southern Spice Market | BEV-BUTTERMILK-6PK | Spiced Buttermilk 200ml x6 | 2 | Rs 84.00 | Rs 168.00 | ACTIVE | Added from the product page | 2026-09-17 19:30 IST |
| customer5.chs@lbos.com | Southern Spice Market | GRO-TAMARIND-500 | Seedless Tamarind 500g | 1 | Rs 88.00 | Rs 88.00 | ACTIVE | Added from the product page | 2026-09-17 19:30 IST |

## Wishlists

Several wishlist entries belong to a retailer outside the customer's default zone (for example customer 1, whose default zone is North, has a West and an East product), so the zone rule for moving a wishlist product into the cart can be exercised.

| Customer | Retailer | Retailer's zone | SKU | Product | Added |
|---|---|---|---|---|---|
| customer1.chn@lbos.com | Hyderabad Harvest Store | East | FRV-MANGO-1KG | Banganapalli Mangoes 1kg | 2026-09-11 20:15 IST |
| customer1.chn@lbos.com | Bengaluru Daily Mart | West | BEV-COFFEE-200 | Filter Coffee Powder 200g | 2026-09-12 20:15 IST |
| customer1.chn@lbos.com | Southern Spice Market | South | ELC-POWERBANK-10K | 10000mAh Power Bank | 2026-09-15 20:15 IST |
| customer2.baw@lbos.com | Hyderabad Harvest Store | East | GRO-BASMATI-5KG | Long Grain Basmati Rice 5kg | 2026-09-08 20:15 IST |
| customer2.baw@lbos.com | Hyderabad Harvest Store | East | PCR-SHAMPOO-340 | Herbal Anti-Dandruff Shampoo 340ml | 2026-09-16 20:15 IST |
| customer3.hye@lbos.com | Bengaluru Daily Mart | West | PKG-BISCUIT-6PK | Butter Cookies Family Pack 6x60g | 2026-09-05 20:15 IST |
| customer3.hye@lbos.com | Southern Spice Market | South | GRO-SAMBAR-200 | Sambar Powder 200g | 2026-09-14 20:15 IST |
| customer4.chn@lbos.com | Bengaluru Daily Mart | West | HHE-DETERGENT-1KG | Detergent Powder 1kg | 2026-09-13 20:15 IST |
| customer4.chn@lbos.com | Chennai Fresh Basket | North | FRV-BANANA-12 | Robusta Bananas (12 pcs) | 2026-09-17 20:15 IST |
| customer5.chs@lbos.com | Chennai Fresh Basket | North | GRO-SONAMASURI-5 | Sona Masoori Rice 5kg | 2026-09-10 20:15 IST |
| customer5.chs@lbos.com | Perambur Daily Needs | North | ELC-LEDBULB-9W | 9W LED Bulb Cool Daylight | 2026-09-18 20:15 IST |
| customer6.baw@lbos.com | Chennai Fresh Basket | North | FRV-TOMATO-1KG | Farm Fresh Tomatoes 1kg | 2026-09-09 20:15 IST |
| customer6.baw@lbos.com | Perambur Daily Needs | North | BEV-JUICE-1L | Mixed Fruit Juice 1L | 2026-09-14 20:15 IST |
| customer7.baw@lbos.com | Perambur Daily Needs | North | DAI-BREAD-400 | Whole Wheat Sandwich Bread 400g | 2026-09-15 20:15 IST |
| customer7.baw@lbos.com | Southern Spice Market | South | PKG-PAPAD-200 | Appalam Papad 200g | 2026-09-16 20:15 IST |

