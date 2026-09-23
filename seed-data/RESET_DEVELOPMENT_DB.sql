-- ============================================================================================================
-- RESET_DEVELOPMENT_DB.sql            *** DEVELOPMENT DATABASE ONLY ***
-- ============================================================================================================
-- Empties every business table of the six AroundU services so the seeders can write the development dataset
-- again from scratch. It deletes ALL rows - the seed data AND anything created through the application.
-- The schema (tables, columns, constraints) is left untouched. NEVER run it against a shared, staging or
-- production database.
--
-- Tables affected (39 - every entity table of the application; the schema itself is kept):
--   S1  state, city, zone, user_account, operations_manager, location_manager, location_manager_assignment_history,
--       password_reset_token
--   S2  retailer, fleet_owner, verification_queue, verification_document
--   S3  customer_profile, customer_address, product_categories, products, customer_cart, customer_cart_item,
--       customer_wishlist_item, customer_review
--   S4  orders, order_item, logistics_booking_detail, trip, trip_status_history
--   S5  driver, vehicle, vehicle_assignment, fleet_expense
--   S6  payment_transaction, customer_invoice, settlement, customer_refund, support_ticket, support_ticket_message,
--       ticket_cluster_incident, notifications, audit_log, tax_configuration
--
-- Dependency order: the services reference each other only through plain UUID / bigint columns (no foreign keys
-- between services), so the order below only has to respect the foreign keys INSIDE a service. A single
-- TRUNCATE ... CASCADE handles those, and RESTART IDENTITY makes the identity ids (products, categories, orders,
-- order items, notifications) start from 1 again, which is what a fresh database gives.
--
-- HOW TO RESET AND RESEED
--   1. Stop all six services (and the gateway).
--   2. psql -h <host> -U <user> -d <development database> -f seed-data/RESET_DEVELOPMENT_DB.sql
--   3. Start the services again (any order): each DataSeeder recreates its part of the dataset, waiting for the
--      rows of the services it depends on. Check the result with seed-data/VALIDATE_SEED_DATA.sql.
-- ============================================================================================================

DO $$
BEGIN
    IF current_database() ~* '(prod|production|live)' THEN
        RAISE EXCEPTION 'Refusing to reset "%": the name looks like a production database', current_database();
    END IF;
END $$;

BEGIN;

TRUNCATE TABLE
    -- S6 - finance, support, engagement
    audit_log, notifications, ticket_cluster_incident, support_ticket_message, support_ticket, customer_refund,
    settlement, customer_invoice, payment_transaction, tax_configuration,
    -- S5 - fleet
    fleet_expense, vehicle_assignment, driver, vehicle,
    -- S4 - orders and logistics
    trip_status_history, trip, logistics_booking_detail, order_item, orders,
    -- S3 - commerce and customers
    customer_review, customer_wishlist_item, customer_cart_item, customer_cart, products, product_categories,
    customer_address, customer_profile,
    -- S2 - partners
    verification_document, verification_queue, fleet_owner, retailer,
    -- S1 - platform and territory
    password_reset_token, location_manager_assignment_history, location_manager, operations_manager, user_account,
    zone, city, state
    RESTART IDENTITY CASCADE;

COMMIT;

-- verification: every table must be empty now
SELECT 'user_account' AS "table", count(*) AS rows FROM user_account
UNION ALL SELECT 'products', count(*) FROM products
UNION ALL SELECT 'orders', count(*) FROM orders
UNION ALL SELECT 'payment_transaction', count(*) FROM payment_transaction;
