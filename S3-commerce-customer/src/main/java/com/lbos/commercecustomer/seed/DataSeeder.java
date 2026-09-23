package com.lbos.commercecustomer.seed;

import static com.lbos.commercecustomer.seed.SeedSupport.LOG;
import static com.lbos.commercecustomer.seed.SeedSupport.at;
import static com.lbos.commercecustomer.seed.SeedSupport.await;
import static com.lbos.commercecustomer.seed.SeedSupport.exists;
import static com.lbos.commercecustomer.seed.SeedSupport.runAsync;
import static com.lbos.commercecustomer.seed.SeedSupport.ts;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * S3 - Commerce &amp; Customer: customers with their two delivery addresses, the product categories, the retailers'
 * products, carts (a single-retailer and multi-retailer ones) and wishlists (see seed-data/CUSTOMERS.md,
 * CATEGORIES.md, PRODUCTS.md, CARTS_AND_WISHLISTS.md).
 *
 * <ul>
 *   <li>Phase 1 (immediately): everything that only depends on S1 / S2 rows.</li>
 *   <li>Phase 2 (background thread, once S4 has seeded the orders): the customers' reviews - a review needs a
 *       delivered order - and their reward-point balances, which checkout changes as orders are placed.</li>
 * </ul>
 * Product and category ids are database identity values (the application never assigns them): rows are inserted
 * without an id and found again by (retailer, SKU) / category name.
 */
@Component
@Order(1)
public class DataSeeder implements ApplicationRunner {

    private final JdbcTemplate jdbc;
    private final boolean enabled;

    public DataSeeder(JdbcTemplate jdbc, @Value("${app.seed.enabled:true}") boolean enabled) {
        this.jdbc = jdbc;
        this.enabled = enabled;
    }

    // ---- customers and addresses -----------------------------------------------------------------------------

    /** customer email, date of birth, joined (days ago) */
    private static final Object[][] CUSTOMERS = {
            {"customer1.chn@lbos.com", "1992-04-18", 55}, {"customer2.baw@lbos.com", "1988-11-02", 54},
            {"customer3.hye@lbos.com", "1995-07-23", 50}, {"customer4.chn@lbos.com", "1990-01-30", 48},
            {"customer5.chs@lbos.com", "1997-09-09", 45}, {"customer6.baw@lbos.com", "1985-06-14", 42},
            {"customer7.baw@lbos.com", "1993-12-05", 40},
    };

    /**
     * Exactly two addresses per customer, always in two different zones; the first is the default.
     * customer email, tag, default, city, zone, line 1, line 2, postal code, latitude, longitude
     */
    private static final Object[][] ADDRESSES = {
            {"customer1.chn@lbos.com", "HOME", true, "Chennai", "North", "Flat 4B, Sri Lakshmi Apartments, 22 Paper Mills Road", "Perambur", "600011", "13.1108", "80.2419"},
            {"customer1.chn@lbos.com", "WORK", false, "Bengaluru", "West", "Third Floor, Tech Park Block C, 80 Feet Road", "Rajajinagar", "560010", "12.9915", "77.5560"},
            {"customer2.baw@lbos.com", "HOME", true, "Bengaluru", "West", "No. 42, 3rd Cross, Basaveshwaranagar", "Near Hanumanthappa Circle", "560079", "12.9899", "77.5385"},
            {"customer2.baw@lbos.com", "OTHER", false, "Hyderabad", "East", "Plot 18, Road No. 3, Vasavi Colony", "Habsiguda", "500007", "17.4086", "78.5442"},
            {"customer3.hye@lbos.com", "HOME", true, "Hyderabad", "East", "H.No. 6-3-112, Sri Sai Nagar Colony", "Uppal", "500039", "17.4008", "78.5603"},
            {"customer3.hye@lbos.com", "WORK", false, "Chennai", "South", "Unit 12, Global Info Park, Rajiv Gandhi Salai", "Thoraipakkam", "600097", "12.9432", "80.2366"},
            {"customer4.chn@lbos.com", "HOME", true, "Chennai", "North", "7/22, Gandhi Street, Kolathur", "Near Kolathur Bus Stand", "600099", "13.1195", "80.2214"},
            {"customer4.chn@lbos.com", "OTHER", false, "Chennai", "South", "Flat 2C, Sea Breeze Residency, Beach Road", "Thiruvanmiyur", "600041", "12.9829", "80.2593"},
            {"customer5.chs@lbos.com", "HOME", true, "Chennai", "South", "18, Second Main Road, Kasturba Nagar", "Adyar", "600020", "13.0012", "80.2565"},
            {"customer5.chs@lbos.com", "WORK", false, "Hyderabad", "East", "Plot 44, Survey No. 7, Nacharam Industrial Area", "Nacharam", "500076", "17.4283", "78.5561"},
            {"customer6.baw@lbos.com", "HOME", true, "Bengaluru", "West", "No. 11, 5th Cross, Vijayanagar Main Road", "Vijayanagar", "560040", "12.9719", "77.5343"},
            {"customer6.baw@lbos.com", "WORK", false, "Chennai", "North", "Godown 3, Manali Road, Tondiarpet", "Near Tondiarpet Signal", "600081", "13.1270", "80.2900"},
            {"customer7.baw@lbos.com", "HOME", true, "Bengaluru", "West", "No. 27, 8th Main, Malleshwaram", "Near Sampige Road", "560003", "13.0035", "77.5710"},
            {"customer7.baw@lbos.com", "OTHER", false, "Chennai", "North", "Flat 12, Lakshmi Towers, Perambur High Road", "Perambur", "600011", "13.1153", "80.2388"},
    };

    // ---- categories -----------------------------------------------------------------------------------------

    /** name, description, status */
    private static final String[][] CATEGORIES = {
            {"Fresh Produce", "Farm-fresh fruits and vegetables sourced daily from local growers and markets", "ACTIVE"},
            {"Groceries & Staples", "Rice, atta, pulses, oils, spices and sugar for the everyday kitchen", "ACTIVE"},
            {"Dairy & Bakery", "Milk, curd, paneer, bread and freshly baked items delivered chilled", "ACTIVE"},
            {"Beverages", "Tea, coffee, juices and ready-to-drink beverages", "ACTIVE"},
            {"Packaged Foods", "Snacks, noodles, biscuits and ready-to-eat packaged food", "ACTIVE"},
            {"Household Essentials", "Cleaning products and everyday home care supplies", "ACTIVE"},
            {"Personal Care", "Soaps, shampoos and daily grooming products", "ACTIVE"},
            {"Electronics", "Small electronics and accessories - bulbs, chargers and power banks", "ACTIVE"},
            {"Festive Gifting", "Seasonal gift hampers - not on sale outside the festive season", "INACTIVE"},
    };

    // ---- products (30) --------------------------------------------------------------------------------------

    /** retailer email, category, SKU, name, description, unit price, opening stock, low-stock threshold, weight kg, status */
    private static final String[][] PRODUCTS = {
            // Chennai Fresh Basket (Chennai / North)
            {"retailer1.chn@lbos.com", "Fresh Produce", "FRV-TOMATO-1KG", "Farm Fresh Tomatoes 1kg", "Firm, ripe red tomatoes picked the same morning, ideal for curries, chutneys and salads.", "38.00", "120", "25", "1.000", "ACTIVE"},
            {"retailer1.chn@lbos.com", "Fresh Produce", "FRV-BANANA-12", "Robusta Bananas (12 pcs)", "A dozen naturally ripened robusta bananas, sweet and evenly yellow.", "52.00", "90", "20", "1.200", "ACTIVE"},
            {"retailer1.chn@lbos.com", "Groceries & Staples", "GRO-SONAMASURI-5", "Sona Masoori Rice 5kg", "Lightweight, aged sona masoori rice that cooks fluffy - a daily staple for South Indian meals.", "349.00", "60", "15", "5.000", "ACTIVE"},
            {"retailer1.chn@lbos.com", "Groceries & Staples", "GRO-TOORDAL-1KG", "Toor Dal 1kg", "Polished, unoiled toor dal that cooks quickly and evenly for sambar and dal.", "165.00", "80", "20", "1.000", "ACTIVE"},
            {"retailer1.chn@lbos.com", "Dairy & Bakery", "DAI-MILK-500", "Full Cream Milk 500ml", "Pasteurised full cream milk in a 500 ml pouch, delivered chilled.", "30.00", "200", "40", "0.520", "ACTIVE"},
            {"retailer1.chn@lbos.com", "Household Essentials", "HHE-DISHWASH-500", "Lemon Dishwash Liquid 500ml", "Grease-cutting lemon dishwash liquid that is gentle on hands and rinses clean.", "99.00", "70", "15", "0.550", "ACTIVE"},
            // Perambur Daily Needs (Chennai / North)
            {"retailer5.chn@lbos.com", "Dairy & Bakery", "DAI-CURD-400", "Fresh Set Curd 400g", "Thick, creamy set curd made daily, packed in a 400 g cup.", "40.00", "100", "20", "0.420", "ACTIVE"},
            {"retailer5.chn@lbos.com", "Dairy & Bakery", "DAI-BREAD-400", "Whole Wheat Sandwich Bread 400g", "Soft whole wheat sandwich bread, baked fresh each morning, 400 g loaf.", "45.00", "80", "15", "0.400", "ACTIVE"},
            {"retailer5.chn@lbos.com", "Beverages", "BEV-JUICE-1L", "Mixed Fruit Juice 1L", "Ready-to-drink mixed fruit juice in a 1 litre carton with no added colour.", "110.00", "60", "12", "1.050", "ACTIVE"},
            {"retailer5.chn@lbos.com", "Packaged Foods", "PKG-NOODLES-4PK", "Masala Instant Noodles 4-Pack", "Four-pack of masala instant noodles with a seasoning sachet, ready in three minutes.", "68.00", "150", "30", "0.350", "ACTIVE"},
            {"retailer5.chn@lbos.com", "Personal Care", "PCR-SOAP-4PK", "Sandalwood Bath Soap 4-Pack", "Pack of four sandalwood-scented bath soaps, 75 g each, mild on skin.", "140.00", "90", "20", "0.500", "ACTIVE"},
            {"retailer5.chn@lbos.com", "Electronics", "ELC-LEDBULB-9W", "9W LED Bulb Cool Daylight", "Energy-saving 9 watt cool daylight LED bulb with a B22 cap and a two-year replacement warranty.", "89.00", "110", "20", "0.080", "ACTIVE"},
            // Bengaluru Daily Mart (Bengaluru / West)
            {"retailer2.baw@lbos.com", "Fresh Produce", "FRV-ONION-2KG", "Nashik Onions 2kg", "Hand-sorted Nashik onions with dry skins and a good shelf life, 2 kg bag.", "64.00", "140", "30", "2.000", "ACTIVE"},
            {"retailer2.baw@lbos.com", "Groceries & Staples", "GRO-ATTA-5KG", "Whole Wheat Atta 5kg", "Stone-ground whole wheat atta for soft rotis and chapatis, 5 kg pack.", "265.00", "70", "15", "5.000", "ACTIVE"},
            {"retailer2.baw@lbos.com", "Groceries & Staples", "GRO-SUGAR-1KG", "Refined Sugar 1kg", "Free-flowing refined white sugar in a sealed 1 kg pack.", "46.00", "150", "30", "1.000", "ACTIVE"},
            {"retailer2.baw@lbos.com", "Beverages", "BEV-COFFEE-200", "Filter Coffee Powder 200g", "Freshly roasted 80:20 coffee-chicory filter coffee powder, 200 g pack.", "185.00", "60", "12", "0.220", "ACTIVE"},
            {"retailer2.baw@lbos.com", "Packaged Foods", "PKG-BISCUIT-6PK", "Butter Cookies Family Pack 6x60g", "Six 60 g packs of crisp butter cookies - a family pack for tea time.", "120.00", "100", "20", "0.400", "ACTIVE"},
            {"retailer2.baw@lbos.com", "Household Essentials", "HHE-DETERGENT-1KG", "Detergent Powder 1kg", "Machine and hand wash detergent powder with a fresh fragrance, 1 kg pack.", "135.00", "80", "15", "1.020", "ACTIVE"},
            // Hyderabad Harvest Store (Hyderabad / East)
            {"retailer3.hye@lbos.com", "Fresh Produce", "FRV-MANGO-1KG", "Banganapalli Mangoes 1kg", "Sweet, fibre-free Banganapalli mangoes ripened naturally, sold per kilogram.", "120.00", "60", "15", "1.000", "ACTIVE"},
            {"retailer3.hye@lbos.com", "Groceries & Staples", "GRO-BASMATI-5KG", "Long Grain Basmati Rice 5kg", "Aged extra-long grain basmati rice that stays fluffy - ideal for biryani and pulao.", "620.00", "45", "10", "5.000", "ACTIVE"},
            {"retailer3.hye@lbos.com", "Groceries & Staples", "GRO-OIL-1L", "Refined Sunflower Oil 1L", "Light, refined sunflower oil in a 1 litre pouch for everyday cooking.", "155.00", "90", "20", "0.920", "ACTIVE"},
            {"retailer3.hye@lbos.com", "Dairy & Bakery", "DAI-PANEER-200", "Fresh Paneer 200g", "Soft, fresh paneer block made from full cream milk, 200 g vacuum pack.", "95.00", "50", "12", "0.210", "ACTIVE"},
            {"retailer3.hye@lbos.com", "Beverages", "BEV-TEA-500", "Assam CTC Tea 500g", "Strong, aromatic Assam CTC tea leaves in a 500 g resealable pack.", "240.00", "70", "15", "0.520", "ACTIVE"},
            {"retailer3.hye@lbos.com", "Personal Care", "PCR-SHAMPOO-340", "Herbal Anti-Dandruff Shampoo 340ml", "Herbal anti-dandruff shampoo with neem and tea tree extracts, 340 ml bottle.", "245.00", "65", "12", "0.380", "ACTIVE"},
            // Southern Spice Market (Chennai / South)
            {"retailer4.chs@lbos.com", "Groceries & Staples", "GRO-SAMBAR-200", "Sambar Powder 200g", "Freshly ground sambar powder made with roasted coriander, dal and red chillies.", "92.00", "100", "20", "0.210", "ACTIVE"},
            {"retailer4.chs@lbos.com", "Groceries & Staples", "GRO-TAMARIND-500", "Seedless Tamarind 500g", "Cleaned, seedless tamarind block with a rich sour taste, 500 g pack.", "88.00", "80", "15", "0.510", "ACTIVE"},
            {"retailer4.chs@lbos.com", "Packaged Foods", "PKG-PAPAD-200", "Appalam Papad 200g", "Crisp urad dal appalam papads that puff up when fried, 200 g pack.", "55.00", "120", "25", "0.210", "ACTIVE"},
            {"retailer4.chs@lbos.com", "Beverages", "BEV-BUTTERMILK-6PK", "Spiced Buttermilk 200ml x6", "Six 200 ml packs of ready-to-drink spiced buttermilk with curry leaf and ginger.", "84.00", "90", "20", "1.300", "ACTIVE"},
            {"retailer4.chs@lbos.com", "Electronics", "ELC-POWERBANK-10K", "10000mAh Power Bank", "10000 mAh power bank with dual USB output, fast charging and a battery level indicator.", "899.00", "40", "8", "0.250", "ACTIVE"},
            {"retailer4.chs@lbos.com", "Household Essentials", "HHE-FLOORCLEAN-1L", "Floor Cleaner Pine Fragrance 1L", "Disinfectant floor cleaner with a pine fragrance - listing being prepared, not yet on sale.", "148.00", "60", "12", "1.100", "DRAFT"},
    };

    // ---- carts and wishlists ---------------------------------------------------------------------------------

    /** customer, retailer, SKU, quantity, added (days ago), note. C1 and C4 hold multi-retailer carts. */
    private static final Object[][] CART_ITEMS = {
            {"customer1.chn@lbos.com", "retailer1.chn@lbos.com", "FRV-BANANA-12", 2, 1, "Needed for the weekend"},
            {"customer1.chn@lbos.com", "retailer1.chn@lbos.com", "DAI-MILK-500", 2, 1, "Morning delivery preferred"},
            {"customer1.chn@lbos.com", "retailer5.chn@lbos.com", "DAI-CURD-400", 1, 1, "Added from the product page"},
            {"customer1.chn@lbos.com", "retailer5.chn@lbos.com", "PKG-NOODLES-4PK", 2, 1, "Added from the product page"},
            {"customer2.baw@lbos.com", "retailer2.baw@lbos.com", "HHE-DETERGENT-1KG", 1, 2, "Refill for the laundry"},
            {"customer2.baw@lbos.com", "retailer2.baw@lbos.com", "BEV-COFFEE-200", 1, 2, "Added from the product page"},
            {"customer3.hye@lbos.com", "retailer3.hye@lbos.com", "FRV-MANGO-1KG", 2, 0, "Added from the wishlist"},
            {"customer3.hye@lbos.com", "retailer3.hye@lbos.com", "DAI-PANEER-200", 1, 0, "Added from the product page"},
            {"customer4.chn@lbos.com", "retailer1.chn@lbos.com", "GRO-SONAMASURI-5", 1, 1, "Added from the product page"},
            {"customer4.chn@lbos.com", "retailer5.chn@lbos.com", "DAI-BREAD-400", 2, 1, "Added from the product page"},
            {"customer5.chs@lbos.com", "retailer4.chs@lbos.com", "GRO-TAMARIND-500", 1, 3, "Added from the product page"},
            {"customer5.chs@lbos.com", "retailer4.chs@lbos.com", "BEV-BUTTERMILK-6PK", 2, 3, "Added from the product page"},
    };

    /** customer, retailer, SKU, added (days ago). Several are products of a retailer outside the customer's default zone. */
    private static final Object[][] WISHLIST = {
            {"customer1.chn@lbos.com", "retailer3.hye@lbos.com", "FRV-MANGO-1KG", 9},
            {"customer1.chn@lbos.com", "retailer2.baw@lbos.com", "BEV-COFFEE-200", 8},
            {"customer1.chn@lbos.com", "retailer4.chs@lbos.com", "ELC-POWERBANK-10K", 5},
            {"customer2.baw@lbos.com", "retailer3.hye@lbos.com", "GRO-BASMATI-5KG", 12},
            {"customer2.baw@lbos.com", "retailer3.hye@lbos.com", "PCR-SHAMPOO-340", 4},
            {"customer3.hye@lbos.com", "retailer2.baw@lbos.com", "PKG-BISCUIT-6PK", 15},
            {"customer3.hye@lbos.com", "retailer4.chs@lbos.com", "GRO-SAMBAR-200", 6},
            {"customer4.chn@lbos.com", "retailer2.baw@lbos.com", "HHE-DETERGENT-1KG", 7},
            {"customer4.chn@lbos.com", "retailer1.chn@lbos.com", "FRV-BANANA-12", 3},
            {"customer5.chs@lbos.com", "retailer1.chn@lbos.com", "GRO-SONAMASURI-5", 10},
            {"customer5.chs@lbos.com", "retailer5.chn@lbos.com", "ELC-LEDBULB-9W", 2},
            {"customer6.baw@lbos.com", "retailer1.chn@lbos.com", "FRV-TOMATO-1KG", 11},
            {"customer6.baw@lbos.com", "retailer5.chn@lbos.com", "BEV-JUICE-1L", 6},
            {"customer7.baw@lbos.com", "retailer5.chn@lbos.com", "DAI-BREAD-400", 5},
            {"customer7.baw@lbos.com", "retailer4.chs@lbos.com", "PKG-PAPAD-200", 4},
    };

    /** customer, retailer, SKU, rating, text, days after the order was placed */
    private static final Object[][] REVIEWS = {
            {"customer1.chn@lbos.com", "retailer1.chn@lbos.com", "GRO-TOORDAL-1KG", 5, "Clean, evenly sized dal that cooks in no time. The sambar turned out perfect.", 2, 1},
            {"customer1.chn@lbos.com", "retailer1.chn@lbos.com", "DAI-MILK-500", 4, "Milk arrived properly chilled and the pouches were intact. Fresh taste.", 2, 1},
            {"customer1.chn@lbos.com", "retailer5.chn@lbos.com", "DAI-CURD-400", 5, "Thick, mildly sour curd exactly like homemade. Will order again.", 2, 1},
            {"customer1.chn@lbos.com", "retailer5.chn@lbos.com", "BEV-JUICE-1L", 3, "Tastes fine but a little too sweet for our family.", 2, 1},
            {"customer2.baw@lbos.com", "retailer2.baw@lbos.com", "GRO-ATTA-5KG", 5, "Rotis stay soft even after a couple of hours. Very good atta for the price.", 3, 1},
            {"customer2.baw@lbos.com", "retailer2.baw@lbos.com", "BEV-COFFEE-200", 5, "Strong aroma and a proper filter-coffee decoction. Packed well.", 3, 1},
            {"customer2.baw@lbos.com", "retailer2.baw@lbos.com", "GRO-SUGAR-1KG", 4, "Clean, dry sugar and delivered quickly.", 3, 1},
            {"customer6.baw@lbos.com", "retailer2.baw@lbos.com", "BEV-COFFEE-200", 4, "Good coffee, slightly stronger chicory than I usually like.", 2, 1},
            {"customer6.baw@lbos.com", "retailer2.baw@lbos.com", "PKG-BISCUIT-6PK", 5, "Crisp cookies and every pack was sealed. The kids finished them in two days.", 2, 1},
            {"customer1.chn@lbos.com", "retailer2.baw@lbos.com", "PKG-BISCUIT-6PK", 5, "Ordered these to my parents' place in Bengaluru - fresh, crisp and well packed. They loved them.", 2, 1},
            {"customer2.baw@lbos.com", "retailer2.baw@lbos.com", "PKG-BISCUIT-6PK", 5, "Perfect with evening coffee. One pack was missing on my first order, support sorted it out quickly.", 3, 1},
            {"customer2.baw@lbos.com", "retailer2.baw@lbos.com", "PKG-BISCUIT-6PK", 4, "Reordered and the quality is the same as before - still good value.", 2, 2},
            {"customer7.baw@lbos.com", "retailer2.baw@lbos.com", "PKG-BISCUIT-6PK", 5, "Delivery was very late but the cookies were fresh and sealed, so I am still giving five stars for the product.", 0, 1},
            {"customer3.hye@lbos.com", "retailer3.hye@lbos.com", "GRO-BASMATI-5KG", 5, "Long grains that stay separate - the biryani came out great.", 3, 1},
            {"customer3.hye@lbos.com", "retailer3.hye@lbos.com", "GRO-OIL-1L", 4, "Light oil with no smell. Pouch was well packed.", 3, 1},
            {"customer3.hye@lbos.com", "retailer3.hye@lbos.com", "DAI-PANEER-200", 2, "The paneer was a little dry and crumbled while cutting.", 1, 1},
            {"customer5.chs@lbos.com", "retailer4.chs@lbos.com", "GRO-SAMBAR-200", 5, "Freshly ground and very fragrant - tastes like my mother's sambar powder.", 2, 1},
            {"customer5.chs@lbos.com", "retailer4.chs@lbos.com", "PKG-PAPAD-200", 4, "Puffs up nicely when fried. Packet was slightly crushed but the papads were whole.", 2, 1},
            {"customer5.chs@lbos.com", "retailer4.chs@lbos.com", "ELC-POWERBANK-10K", 1, "The casing was cracked when it arrived. Support refunded me quickly, but I would not buy this model again.", 1, 1},
            {"customer4.chn@lbos.com", "retailer5.chn@lbos.com", "PKG-NOODLES-4PK", 4, "Good masala flavour and the pack size is convenient.", 2, 1},
            {"customer4.chn@lbos.com", "retailer5.chn@lbos.com", "PCR-SOAP-4PK", 5, "Lovely sandalwood fragrance that lasts, and the soap does not dry the skin.", 2, 1},
            {"customer3.hye@lbos.com", "retailer3.hye@lbos.com", "PCR-SHAMPOO-340", 4, "Reduced flakes within two weeks and the fragrance is mild.", 2, 1},
    };

    /** The seeding runs on a background thread, so S3 starts without waiting for the other services. */
    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            LOG.info("S3 seed skipped (app.seed.enabled=false)");
            return;
        }
        runAsync("seed-s3", this::seedAll);
    }

    private void seedAll() {
        for (Object[] c : CUSTOMERS) seedCustomer(c);
        for (Object[] a : ADDRESSES) seedAddress(a);
        for (String[] c : CATEGORIES) seedCategory(c);
        for (String[] p : PRODUCTS) seedProduct(p);
        for (Object[] i : CART_ITEMS) seedCartItem(i);
        for (Object[] w : WISHLIST) seedWishlistItem(w);
        LOG.info("S3 seed: {} customers, {} addresses, {} categories, {} products, {} cart lines, {} wishlist entries",
                CUSTOMERS.length, ADDRESSES.length, CATEGORIES.length, PRODUCTS.length, CART_ITEMS.length, WISHLIST.length);
        seedOrderDependentData();
    }

    // ---- lookups ---------------------------------------------------------------------------------------------

    private UUID account(String email) {
        return await(jdbc, "account " + email, UUID.class, "select user_account_id from user_account where email = ?", email);
    }

    private UUID customerProfile(String email) {
        return jdbc.queryForObject("select customer_profile_id from customer_profile where user_account_id = ?", UUID.class, account(email));
    }

    private UUID retailerId(String email) {
        return await(jdbc, "retailer " + email, UUID.class,
                "select r.retailer_id from retailer r join user_account u on u.user_account_id = r.user_account_id where u.email = ?", email);
    }

    private Long productId(String retailerEmail, String sku) {
        return jdbc.queryForObject("select product_id from products where retailer_id = ? and sku = ?", Long.class, retailerId(retailerEmail), sku);
    }

    // ---- customers / addresses ---------------------------------------------------------------------------

    private void seedCustomer(Object[] c) {
        UUID accountId = account((String) c[0]);
        if (exists(jdbc, "select count(*) from customer_profile where user_account_id = ?", accountId)) return;
        jdbc.update("insert into customer_profile(customer_profile_id, user_account_id, date_of_birth, profile_status, reward_points_balance) "
                        + "values (?,?,?,?,?)",
                UUID.randomUUID(), accountId, Date.valueOf(LocalDate.parse((String) c[1])), "ACTIVE", BigDecimal.ZERO);
    }

    private void seedAddress(Object[] a) {
        UUID profileId = customerProfile((String) a[0]);
        UUID cityId = await(jdbc, "city " + a[3], UUID.class, "select city_id from city where city_name = ?", a[3]);
        UUID zoneId = await(jdbc, "zone " + a[3] + "/" + a[4], UUID.class,
                "select z.zone_id from zone z join city c on c.city_id = z.city_id where c.city_name = ? and z.zone_name = ?", a[3], a[4]);
        if (exists(jdbc, "select count(*) from customer_address where customer_profile_id = ? and zone_id = ?", profileId, zoneId)) return;
        jdbc.update("insert into customer_address(customer_address_id, customer_profile_id, city_id, zone_id, address_tag, address_line_1, "
                        + "address_line_2, postal_code, latitude, longitude, is_default) values (?,?,?,?,?,?,?,?,?,?,?)",
                UUID.randomUUID(), profileId, cityId, zoneId, a[1], a[5], a[6], a[7], new BigDecimal((String) a[8]),
                new BigDecimal((String) a[9]), a[2]);
    }

    // ---- categories / products ---------------------------------------------------------------------------

    private void seedCategory(String[] c) {
        if (exists(jdbc, "select count(*) from product_categories where category_name = ?", c[0])) return;
        jdbc.update("insert into product_categories(category_name, description, status) values (?,?,?)", c[0], c[1], c[2]);
    }

    private void seedProduct(String[] p) {
        UUID retailerId = retailerId(p[0]);
        if (exists(jdbc, "select count(*) from products where retailer_id = ? and sku = ?", retailerId, p[2])) return;
        Long categoryId = jdbc.queryForObject("select category_id from product_categories where category_name = ?", Long.class, p[1]);
        int listedDaysAgo = 60 - (Math.abs(p[2].hashCode()) % 10);
        OffsetDateTime created = at(listedDaysAgo, 11, 0);
        jdbc.update("insert into products(category_id, retailer_id, sku, product_name, description, unit_price, stock_quantity, status, "
                        + "created_at, updated_at, quality_flag, low_stock_threshold, weight_kg) values (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                categoryId, retailerId, p[2], p[3], p[4], new BigDecimal(p[5]), Integer.parseInt(p[6]), p[9], ts(created), ts(created),
                null, Integer.parseInt(p[7]), new BigDecimal(p[8]));
    }

    // ---- carts / wishlist ----------------------------------------------------------------------------------

    private void seedCartItem(Object[] i) {
        UUID profileId = customerProfile((String) i[0]);
        Long productId = productId((String) i[1], (String) i[2]);
        if (exists(jdbc, "select count(*) from customer_cart where customer_profile_id = ? and product_id = ?", profileId, productId)) return;
        UUID cartId = UUID.randomUUID();
        OffsetDateTime added = at((Integer) i[4], 19, 30);
        jdbc.update("insert into customer_cart(cart_id, customer_profile_id, product_id, added_at) values (?,?,?,?)",
                cartId, profileId, productId, ts(added));
        jdbc.update("insert into customer_cart_item(cart_item_id, cart_id, retailer_id, quantity, status, description, created_at, updated_at) "
                        + "values (?,?,?,?,?,?,?,?)",
                UUID.randomUUID(), cartId, retailerId((String) i[1]), i[3], "ACTIVE", i[5], ts(added), ts(added));
    }

    private void seedWishlistItem(Object[] w) {
        UUID profileId = customerProfile((String) w[0]);
        Long productId = productId((String) w[1], (String) w[2]);
        if (exists(jdbc, "select count(*) from customer_wishlist_item where customer_profile_id = ? and product_id = ?", profileId, productId)) return;
        jdbc.update("insert into customer_wishlist_item(wishlist_item_id, customer_profile_id, product_id, created_at) values (?,?,?,?)",
                UUID.randomUUID(), profileId, productId, ts(at((Integer) w[3], 20, 15)));
    }

    // ---- phase 2: reviews and reward points (need S4's orders) -------------------------------------------

    private void seedOrderDependentData() {
        try {
            // S4 has seeded its orders once the last delivered order of the plan exists
            await(jdbc, "the seeded orders of S4", Integer.class,
                    "select case when count(*) >= 23 then 1 end from orders");
            for (Object[] r : REVIEWS) seedReview(r);
            refreshQualityFlags();
            refreshRewardPoints();
            LOG.info("S3 seed: {} reviews written, reward-point balances and product quality flags refreshed", REVIEWS.length);
        } catch (RuntimeException failure) {
            LOG.error("S3 seed: reviews / reward points not written - {}", failure.getMessage());
        }
    }

    /** A review needs the customer's own DELIVERED order that contains the product (unique per order + product). */
    private void seedReview(Object[] r) {
        UUID profileId = customerProfile((String) r[0]);
        Long productId = productId((String) r[1], (String) r[2]);
        int purchase = ((Number) r[6]).intValue();
        List<Map<String, Object>> orders = jdbc.queryForList(
                "select o.order_id, o.order_date, o.updated_datetime from orders o join order_item oi on oi.order_id = o.order_id "
                        + "where o.customer_profile_id = ? and oi.product_id = ? and o.order_status = 'DELIVERED' order by o.order_date",
                profileId, productId);
        if (orders.size() < purchase) {
            LOG.warn("S3 seed: {} has no delivered purchase #{} of {} - review skipped", r[0], purchase, r[2]);
            return;
        }
        Map<String, Object> order = orders.get(purchase - 1);
        Long orderId = ((Number) order.get("order_id")).longValue();
        if (exists(jdbc, "select count(*) from customer_review where order_id = ? and product_id = ?", orderId, productId)) return;
        OffsetDateTime placed = ((java.sql.Timestamp) order.get("order_date")).toLocalDateTime().atOffset(SeedSupport.IST);
        OffsetDateTime delivered = ((java.sql.Timestamp) order.get("updated_datetime")).toLocalDateTime().atOffset(SeedSupport.IST);
        OffsetDateTime created = placed.plusDays(((Number) r[5]).longValue()).plusHours(3);
        if (created.isBefore(delivered.plusMinutes(30))) created = delivered.plusMinutes(30); // reviewed only after delivery
        jdbc.update("insert into customer_review(customer_review_id, order_id, product_id, customer_id, rating, review_text, created_at) "
                        + "values (?,?,?,?,?,?,?)",
                UUID.randomUUID(), orderId, productId, profileId, ((Number) r[3]).shortValue(), r[4], ts(created));
    }

    /** ReviewServiceImpl.refreshQualityFlag: TRENDING = at least 5 reviews averaging 4.5+, LOW_RATED = 5+ reviews averaging 2.0 or less. */
    private void refreshQualityFlags() {
        jdbc.update("update products set quality_flag = null");
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select product_id, count(*) as cnt, avg(rating) as average from customer_review group by product_id");
        for (Map<String, Object> row : rows) {
            long count = ((Number) row.get("cnt")).longValue();
            double average = ((Number) row.get("average")).doubleValue();
            String flag = count >= 5 && average >= 4.5 ? "TRENDING" : count >= 5 && average <= 2.0 ? "LOW_RATED" : null;
            if (flag != null) jdbc.update("update products set quality_flag = ? where product_id = ?", flag, row.get("product_id"));
        }
    }

    /**
     * CheckoutServiceImpl earns 2% of the checkout's grand total as reward points and takes redeemed points off it.
     * One checkout = the orders one customer placed at the same moment; cancelled or rejected orders still earned
     * their points when checkout was prepared, so they are included.
     */
    private void refreshRewardPoints() {
        List<Map<String, Object>> checkouts = jdbc.queryForList(
                "select customer_profile_id, order_date, sum(total_amount) as total, sum(discount_amount) as redeemed from orders "
                        + "where order_type = 'RETAIL' group by customer_profile_id, order_date");
        Map<Object, BigDecimal> balance = new java.util.HashMap<>();
        for (Map<String, Object> checkout : checkouts) {
            BigDecimal earned = ((BigDecimal) checkout.get("total")).multiply(new BigDecimal("0.02")).setScale(2, RoundingMode.HALF_UP);
            BigDecimal redeemed = (BigDecimal) checkout.get("redeemed");
            balance.merge(checkout.get("customer_profile_id"), earned.subtract(redeemed), BigDecimal::add);
        }
        balance.forEach((customer, points) ->
                jdbc.update("update customer_profile set reward_points_balance = ? where customer_profile_id = ?", points.max(BigDecimal.ZERO), customer));
    }
}
