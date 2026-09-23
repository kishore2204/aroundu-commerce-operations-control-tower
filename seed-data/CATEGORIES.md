# Product Categories (S3)

> Generated from the seeded database by `seed-data/tools/GenerateSeedDocs.java`; every value below is what the database holds. Long identity ids (products, categories, orders) are the values of a fresh database; UUIDs are random per environment, so records are identified by business key.

Categories are `product_categories` rows with a `Long` identity id. Eight are ACTIVE (each has products and a tax rule per state); "Festive Gifting" is INACTIVE - it cannot be given to a product or a tax rule and shows how the active-only rule of INC0010084 behaves.

| Category id | Name | Description | Status | Products |
|---|---|---|---|---|
| 1 | Fresh Produce | Farm-fresh fruits and vegetables sourced daily from local growers and markets | ACTIVE | 4 |
| 2 | Groceries & Staples | Rice, atta, pulses, oils, spices and sugar for the everyday kitchen | ACTIVE | 8 |
| 3 | Dairy & Bakery | Milk, curd, paneer, bread and freshly baked items delivered chilled | ACTIVE | 4 |
| 4 | Beverages | Tea, coffee, juices and ready-to-drink beverages | ACTIVE | 4 |
| 5 | Packaged Foods | Snacks, noodles, biscuits and ready-to-eat packaged food | ACTIVE | 3 |
| 6 | Household Essentials | Cleaning products and everyday home care supplies | ACTIVE | 3 |
| 7 | Personal Care | Soaps, shampoos and daily grooming products | ACTIVE | 2 |
| 8 | Electronics | Small electronics and accessories - bulbs, chargers and power banks | ACTIVE | 2 |
| 9 | Festive Gifting | Seasonal gift hampers - not on sale outside the festive season | INACTIVE | 0 |

