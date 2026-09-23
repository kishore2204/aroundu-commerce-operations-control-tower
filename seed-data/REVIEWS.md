# Reviews (S3)

> Generated from the seeded database by `seed-data/tools/GenerateSeedDocs.java`; every value below is what the database holds. Long identity ids (products, categories, orders) are the values of a fresh database; UUIDs are random per environment, so records are identified by business key.

A review requires the customer's own **DELIVERED** order that contains the product, and is unique per `(order, product)` (`ReviewServiceImpl`). Every review below references such an order, is dated after that order's delivery, and rates 1-5.

| Customer | Product SKU | Order | Delivered | Rating | Review | Reviewed |
|---|---|---|---|---|---|---|
| customer2.baw@lbos.com | BEV-COFFEE-200 | ORD-1787286000000-1 | 2026-08-21 10:48 IST | 5 | Strong aroma and a proper filter-coffee decoction. Packed well. | 2026-08-24 12:50 IST |
| customer6.baw@lbos.com | BEV-COFFEE-200 | ORD-1788331500000-1 | 2026-09-02 13:16 IST | 4 | Good coffee, slightly stronger chicory than I usually like. | 2026-09-04 15:15 IST |
| customer1.chn@lbos.com | BEV-JUICE-1L | ORD-1788702000000-2 | 2026-09-06 20:13 IST | 3 | Tastes fine but a little too sweet for our family. | 2026-09-08 22:10 IST |
| customer1.chn@lbos.com | DAI-CURD-400 | ORD-1788702000000-2 | 2026-09-06 20:13 IST | 5 | Thick, mildly sour curd exactly like homemade. Will order again. | 2026-09-08 22:10 IST |
| customer1.chn@lbos.com | DAI-MILK-500 | ORD-1788702000000-1 | 2026-09-06 20:22 IST | 4 | Milk arrived properly chilled and the pouches were intact. Fresh taste. | 2026-09-08 22:10 IST |
| customer3.hye@lbos.com | DAI-PANEER-200 | ORD-1789129800000-1 | 2026-09-11 19:02 IST | 2 | The paneer was a little dry and crumbled while cutting. | 2026-09-12 21:00 IST |
| customer5.chs@lbos.com | ELC-POWERBANK-10K | ORD-1789293900000-1 | 2026-09-13 16:43 IST | 1 | The casing was cracked when it arrived. Support refunded me quickly, but I would not buy this model again. | 2026-09-14 18:35 IST |
| customer2.baw@lbos.com | GRO-ATTA-5KG | ORD-1786427400000-1 | 2026-08-11 12:31 IST | 5 | Rotis stay soft even after a couple of hours. Very good atta for the price. | 2026-08-14 14:20 IST |
| customer3.hye@lbos.com | GRO-BASMATI-5KG | ORD-1786623300000-1 | 2026-08-13 18:49 IST | 5 | Long grains that stay separate - the biryani came out great. | 2026-08-16 20:45 IST |
| customer3.hye@lbos.com | GRO-OIL-1L | ORD-1786623300000-1 | 2026-08-13 18:49 IST | 4 | Light oil with no smell. Pouch was well packed. | 2026-08-16 20:45 IST |
| customer5.chs@lbos.com | GRO-SAMBAR-200 | ORD-1787490000000-1 | 2026-08-23 19:39 IST | 5 | Freshly ground and very fragrant - tastes like my mother's sambar powder. | 2026-08-25 21:30 IST |
| customer2.baw@lbos.com | GRO-SUGAR-1KG | ORD-1786427400000-1 | 2026-08-11 12:31 IST | 4 | Clean, dry sugar and delivered quickly. | 2026-08-14 14:20 IST |
| customer1.chn@lbos.com | GRO-TOORDAL-1KG | ORD-1787319300000-1 | 2026-08-21 20:11 IST | 5 | Clean, evenly sized dal that cooks in no time. The sambar turned out perfect. | 2026-08-23 22:05 IST |
| customer3.hye@lbos.com | PCR-SHAMPOO-340 | ORD-1789129800000-1 | 2026-09-11 19:02 IST | 4 | Reduced flakes within two weeks and the fragrance is mild. | 2026-09-13 21:00 IST |
| customer4.chn@lbos.com | PCR-SOAP-4PK | ORD-1788532500000-1 | 2026-09-04 21:19 IST | 5 | Lovely sandalwood fragrance that lasts, and the soap does not dry the skin. | 2026-09-06 23:05 IST |
| customer2.baw@lbos.com | PKG-BISCUIT-6PK | ORD-1787286000000-1 | 2026-08-21 10:48 IST | 5 | Perfect with evening coffee. One pack was missing on my first order, support sorted it out quickly. | 2026-08-24 12:50 IST |
| customer6.baw@lbos.com | PKG-BISCUIT-6PK | ORD-1788331500000-1 | 2026-09-02 13:16 IST | 5 | Crisp cookies and every pack was sealed. The kids finished them in two days. | 2026-09-04 15:15 IST |
| customer1.chn@lbos.com | PKG-BISCUIT-6PK | ORD-1789026900000-1 | 2026-09-10 14:30 IST | 5 | Ordered these to my parents' place in Bengaluru - fresh, crisp and well packed. They loved them. | 2026-09-12 16:25 IST |
| customer2.baw@lbos.com | PKG-BISCUIT-6PK | ORD-1789393800000-1 | 2026-09-14 20:20 IST | 4 | Reordered and the quality is the same as before - still good value. | 2026-09-16 22:20 IST |
| customer7.baw@lbos.com | PKG-BISCUIT-6PK | ORD-1789821300000-1 | 2026-09-19 22:15 IST | 5 | Delivery was very late but the cookies were fresh and sealed, so I am still giving five stars for the product. | 2026-09-19 22:45 IST |
| customer4.chn@lbos.com | PKG-NOODLES-4PK | ORD-1788532500000-1 | 2026-09-04 21:19 IST | 4 | Good masala flavour and the pack size is convenient. | 2026-09-06 23:05 IST |
| customer5.chs@lbos.com | PKG-PAPAD-200 | ORD-1787490000000-1 | 2026-08-23 19:39 IST | 4 | Puffs up nicely when fried. Packet was slightly crushed but the papads were whole. | 2026-08-25 21:30 IST |

Quality flag: `PKG-BISCUIT-6PK` has 5 reviews averaging 4.8, so its `quality_flag` is `TRENDING`; no product qualifies for `LOW_RATED` (5+ reviews averaging 2.0 or less).
