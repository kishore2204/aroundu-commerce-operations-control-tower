BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. STATE
-- ============================================================
CREATE TABLE state (
    state_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    state_name varchar(120) NOT NULL,
    country_code char(2) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT uq_state_name_region UNIQUE (state_name, country_code)
);

-- ============================================================
-- 2. CITY
-- ============================================================
CREATE TABLE city (
    city_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    state_id uuid REFERENCES state(state_id) ON DELETE RESTRICT,
    city_name varchar(120) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT uq_city_name_region UNIQUE (city_name)
);
CREATE INDEX idx_city_state_id ON city(state_id);

-- ============================================================
-- 3. ZONE
-- ============================================================
CREATE TABLE zone (
    zone_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id uuid NOT NULL REFERENCES city(city_id) ON DELETE RESTRICT,
    zone_name varchar(120) NOT NULL,
    is_active boolean NOT NULL DEFAULT true
);
CREATE INDEX idx_zone_city_id ON zone(city_id);

-- ============================================================
-- 4. USER ACCOUNT
-- ============================================================
CREATE TABLE user_account (
    user_account_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(255) NOT NULL UNIQUE,
    phone_number varchar(30) UNIQUE,
    password text NOT NULL,
    first_name varchar(100) NOT NULL,
    last_name varchar(100),
    role varchar(40) NOT NULL,
    account_status varchar(30) NOT NULL DEFAULT 'ACTIVE',
    password_changed_on timestamptz,
    last_login_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 5. OPERATIONS MANAGER
-- ============================================================
CREATE TABLE operations_manager (
    operations_manager_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_account_id uuid NOT NULL UNIQUE
        REFERENCES user_account(user_account_id) ON DELETE CASCADE,
    city_id uuid NOT NULL
        REFERENCES city(city_id) ON DELETE RESTRICT,
    assignment_status varchar(30) NOT NULL DEFAULT 'ACTIVE',
    assigned_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_operations_manager_city_id ON operations_manager(city_id);

-- ============================================================
-- 6. LOCATION MANAGER
-- ============================================================
CREATE TABLE location_manager (
    location_manager_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_account_id uuid NOT NULL UNIQUE
        REFERENCES user_account(user_account_id) ON DELETE CASCADE,
    city_id uuid NOT NULL
        REFERENCES city(city_id) ON DELETE RESTRICT,
    zone_id uuid REFERENCES zone(zone_id) ON DELETE SET NULL,
    operations_manager_id uuid NOT NULL
        REFERENCES operations_manager(operations_manager_id) ON DELETE RESTRICT,
    assignment_status varchar(30) NOT NULL DEFAULT 'ACTIVE',
    assigned_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_location_manager_city_id ON location_manager(city_id);
CREATE INDEX idx_location_manager_zone_id ON location_manager(zone_id);
CREATE INDEX idx_location_manager_operations_manager_id ON location_manager(operations_manager_id);

-- ============================================================
-- 7. AUDIT LOG
-- ============================================================
CREATE TABLE audit_log (
    audit_log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_account_id uuid REFERENCES user_account(user_account_id) ON DELETE SET NULL,
    action varchar(100) NOT NULL,
    source_module varchar(80),
    old_values jsonb,
    new_values jsonb,
    ip_address inet,
    performed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_log_user_account_id ON audit_log(user_account_id);
CREATE INDEX idx_audit_log_performed_at ON audit_log(performed_at);

-- ============================================================
-- 8. NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
    notification_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_account_id uuid NOT NULL REFERENCES user_account(user_account_id) ON DELETE CASCADE,
    role varchar(20) NOT NULL,
    notification_type varchar(50) NOT NULL,
    reference_type varchar(50),
    reference_id uuid,
    title varchar(255) NOT NULL,
    message text NOT NULL,
    is_read boolean NOT NULL DEFAULT false,
    sent_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notifications_user_account_id ON notifications(user_account_id);
CREATE INDEX idx_notifications_reference ON notifications(reference_type, reference_id);

-- ============================================================
-- 9. VERIFICATION QUEUE
-- ============================================================
CREATE TABLE verification_queue (
    verification_queue_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_type varchar(30) NOT NULL,
    subject_id uuid NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    submitted_by_account_id uuid NOT NULL
        REFERENCES user_account(user_account_id) ON DELETE RESTRICT,
    reviewed_by_account_id uuid
        REFERENCES user_account(user_account_id) ON DELETE SET NULL,
    verification_status varchar(30) NOT NULL DEFAULT 'PENDING',
    rejection_reason text,
    suspension_reason text,
    deletion_reason text,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_verification_queue_subject
    ON verification_queue(subject_type, subject_id);
CREATE INDEX idx_verification_queue_submitted_by
    ON verification_queue(submitted_by_account_id);
CREATE INDEX idx_verification_queue_reviewed_by
    ON verification_queue(reviewed_by_account_id);

-- ============================================================
-- 10. VERIFICATION DOCUMENT
-- ============================================================
CREATE TABLE verification_document (
    document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_queue_id uuid NOT NULL
        REFERENCES verification_queue(verification_queue_id) ON DELETE CASCADE,
    document_type_name varchar(120) NOT NULL,
    version_number integer NOT NULL DEFAULT 1,
    file_path text NOT NULL,
    expiry_date date,
    document_status varchar(30) NOT NULL DEFAULT 'UPLOADED',
    reject_reason text,
    is_current_version boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_verification_document_version
        UNIQUE (verification_queue_id, document_type_name, version_number)
);

-- ============================================================
-- 11. RETAILER
-- ============================================================
CREATE TABLE retailer (
    retailer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_account_id uuid NOT NULL UNIQUE
        REFERENCES user_account(user_account_id) ON DELETE CASCADE,
    operations_manager_id uuid
        REFERENCES operations_manager(operations_manager_id) ON DELETE SET NULL,
    city_id uuid NOT NULL
        REFERENCES city(city_id) ON DELETE RESTRICT,
    longitude numeric(10,7),
    latitude numeric(10,7),
    business_name varchar(200) NOT NULL,
    registration_number varchar(100) UNIQUE,
    gst_number varchar(15) UNIQUE,
    retailer_status varchar(30) NOT NULL DEFAULT 'PENDING',
    is_open boolean NOT NULL DEFAULT true,
    opens_at time,
    closes_at time
);
CREATE INDEX idx_retailer_operations_manager_id ON retailer(operations_manager_id);
CREATE INDEX idx_retailer_city_id ON retailer(city_id);

-- ============================================================
-- 12. CUSTOMER PROFILE
-- ============================================================
CREATE TABLE customer_profile (
    customer_profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_account_id uuid NOT NULL UNIQUE
        REFERENCES user_account(user_account_id) ON DELETE CASCADE,
    date_of_birth date,
    profile_status varchar(30) NOT NULL DEFAULT 'ACTIVE',
    reward_points_balance numeric(14,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- 13. CUSTOMER ADDRESS
-- ============================================================
CREATE TABLE customer_address (
    customer_address_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_profile_id uuid NOT NULL
        REFERENCES customer_profile(customer_profile_id) ON DELETE CASCADE,
    city_id uuid NOT NULL REFERENCES city(city_id) ON DELETE RESTRICT,
    zone_id uuid REFERENCES zone(zone_id) ON DELETE SET NULL,
    address_tag varchar(30) NOT NULL DEFAULT 'HOME',
    address_line_1 varchar(255) NOT NULL,
    address_line_2 varchar(255),
    postal_code varchar(20),
    latitude numeric(10,7),
    longitude numeric(10,7),
    is_default boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_customer_address_customer_profile_id
    ON customer_address(customer_profile_id);
CREATE INDEX idx_customer_address_city_id
    ON customer_address(city_id);
CREATE INDEX idx_customer_address_zone_id
    ON customer_address(zone_id);

-- ============================================================
-- 14. PRODUCT CATEGORIES
-- ============================================================
CREATE TABLE product_categories (
    category_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_name varchar(100) NOT NULL UNIQUE,
    description varchar(500),
    status varchar(15) NOT NULL DEFAULT 'ACTIVE'
);

-- ============================================================
-- 15. PRODUCTS
-- ============================================================
CREATE TABLE products (
    product_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id bigint NOT NULL
        REFERENCES product_categories(category_id) ON DELETE RESTRICT,
    retailer_id uuid NOT NULL
        REFERENCES retailer(retailer_id) ON DELETE RESTRICT,
    sku varchar(80) NOT NULL,
    product_name varchar(200) NOT NULL,
    description text,
    unit_price numeric(12,2) NOT NULL,
    stock_quantity integer NOT NULL DEFAULT 0,
    status varchar(15) NOT NULL DEFAULT 'ACTIVE',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_product_retailer_sku UNIQUE (retailer_id, sku)
);
CREATE INDEX idx_products_category_id ON products(category_id);

-- ============================================================
-- 16. CUSTOMER WISHLIST ITEM
-- ============================================================
CREATE TABLE customer_wishlist_item (
    customer_profile_id uuid NOT NULL
        REFERENCES customer_profile(customer_profile_id) ON DELETE CASCADE,
    product_id bigint NOT NULL
        REFERENCES products(product_id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (customer_profile_id, product_id)
);
CREATE INDEX idx_customer_wishlist_item_product_id
    ON customer_wishlist_item(product_id);

-- ============================================================
-- 17. CUSTOMER CART
-- ============================================================
CREATE TABLE customer_cart (
    cart_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_profile_id uuid NOT NULL
        REFERENCES customer_profile(customer_profile_id) ON DELETE CASCADE,
    product_id bigint NOT NULL
        REFERENCES products(product_id) ON DELETE CASCADE,
    added_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_customer_cart_product
        UNIQUE (customer_profile_id, product_id)
);

-- ============================================================
-- 18. CUSTOMER CART ITEM
-- ============================================================
CREATE TABLE customer_cart_item (
    cart_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id uuid NOT NULL
        REFERENCES customer_cart(cart_id) ON DELETE CASCADE,
    retailer_id uuid NOT NULL
        REFERENCES retailer(retailer_id) ON DELETE RESTRICT,
    quantity integer NOT NULL DEFAULT 0,
    status varchar(30) NOT NULL DEFAULT 'ACTIVE',
    description text,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_customer_cart_item UNIQUE (retailer_id, cart_id)
);
CREATE INDEX idx_customer_cart_item_cart_id
    ON customer_cart_item(cart_id);

-- ============================================================
-- 19. ORDERS
-- ============================================================
CREATE TABLE orders (
    order_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_number varchar(30) NOT NULL UNIQUE,
    customer_profile_id uuid NOT NULL
        REFERENCES customer_profile(customer_profile_id) ON DELETE RESTRICT,
    order_type varchar(30) NOT NULL,
    order_date timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subtotal_amount numeric(12,2) NOT NULL DEFAULT 0,
    delivery_charge numeric(12,2) NOT NULL DEFAULT 0,
    discount_amount numeric(12,2) NOT NULL DEFAULT 0,
    total_amount numeric(12,2) NOT NULL,
    order_status varchar(20) NOT NULL DEFAULT 'NEW',
    status_history_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    order_tracking_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    delivery_address varchar(500),
    delivery_latitude numeric(9,6),
    delivery_longitude numeric(9,6),
    payment_method varchar(30) NOT NULL,
    payment_status varchar(25) NOT NULL DEFAULT 'PENDING',
    transaction_reference varchar(100) UNIQUE,
    cancellation_reason varchar(500),
    cancelled_datetime timestamp,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_orders_order_type
        CHECK (order_type IN ('RETAIL', 'FLEET_SERVICE'))
);
CREATE INDEX idx_orders_customer_profile_id ON orders(customer_profile_id);
CREATE INDEX idx_orders_order_status ON orders(order_status);
CREATE INDEX idx_orders_order_date ON orders(order_date);

-- ============================================================
-- 20. ORDER ITEM
-- ============================================================
CREATE TABLE order_item (
    order_item_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id bigint NOT NULL
        REFERENCES orders(order_id) ON DELETE CASCADE,
    retailer_id uuid NOT NULL
        REFERENCES retailer(retailer_id) ON DELETE RESTRICT,
    product_id bigint NOT NULL
        REFERENCES products(product_id) ON DELETE RESTRICT,
    sku_snapshot varchar(80) NOT NULL,
    product_name_snapshot varchar(200) NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    discount_amount numeric(12,2) NOT NULL DEFAULT 0,
    line_total numeric(12,2) NOT NULL
);
CREATE INDEX ix_order_item_order_product
    ON order_item(order_id, product_id);
CREATE INDEX idx_order_item_retailer_id
    ON order_item(retailer_id);

-- ============================================================
-- 21. CUSTOMER INVOICE
-- ============================================================
CREATE TABLE customer_invoice (
    invoice_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id bigint NOT NULL UNIQUE
        REFERENCES orders(order_id) ON DELETE CASCADE,
    invoice_number varchar(50) NOT NULL UNIQUE,
    invoice_date date NOT NULL,
    subtotal_amount numeric(12,2) NOT NULL,
    tax_amount numeric(12,2) NOT NULL DEFAULT 0,
    total_amount numeric(12,2) NOT NULL,
    invoice_status varchar(30) NOT NULL DEFAULT 'ISSUED'
);

-- ============================================================
-- 22. CUSTOMER REVIEW
-- ============================================================
CREATE TABLE customer_review (
    customer_review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id bigint NOT NULL
        REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id bigint
        REFERENCES products(product_id) ON DELETE SET NULL,
    rating smallint NOT NULL,
    review_text text,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_customer_order_product_review
        UNIQUE (order_id, product_id),
    CONSTRAINT chk_customer_review_rating
        CHECK (rating BETWEEN 1 AND 5)
);

-- ============================================================
-- 23. FLEET OWNER
-- ============================================================
CREATE TABLE fleet_owner (
    fleet_owner_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_account_id uuid NOT NULL UNIQUE
        REFERENCES user_account(user_account_id) ON DELETE CASCADE,
    operations_manager_id uuid
        REFERENCES operations_manager(operations_manager_id) ON DELETE SET NULL,
    city_id uuid NOT NULL
        REFERENCES city(city_id) ON DELETE RESTRICT,
    business_name varchar(200),
    bank_verified_by_account_id uuid
        REFERENCES user_account(user_account_id) ON DELETE SET NULL,
    profile_status varchar(30) NOT NULL DEFAULT 'ACTIVE',
    owner_status varchar(30) NOT NULL DEFAULT 'PENDING'
);
CREATE INDEX idx_fleet_owner_operations_manager_id
    ON fleet_owner(operations_manager_id);
CREATE INDEX idx_fleet_owner_city_id
    ON fleet_owner(city_id);

-- ============================================================
-- 24. VEHICLE
-- ============================================================
CREATE TABLE vehicle (
    vehicle_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fleet_owner_id uuid NOT NULL
        REFERENCES fleet_owner(fleet_owner_id) ON DELETE CASCADE,
    updated_by_account_id uuid
        REFERENCES user_account(user_account_id) ON DELETE SET NULL,
    registration_number varchar(30) NOT NULL UNIQUE,
    vehicle_type varchar(50) NOT NULL,
    make varchar(80),
    model varchar(80),
    model_year smallint,
    capacity_kg numeric(10,2),
    vehicle_status varchar(30) NOT NULL DEFAULT 'ACTIVE',
    latitude numeric(9,6),
    longitude numeric(9,6)
);
CREATE INDEX idx_vehicle_fleet_owner_id ON vehicle(fleet_owner_id);

-- ============================================================
-- 25. DRIVER
-- ============================================================
CREATE TABLE driver (
    driver_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fleet_owner_id uuid
        REFERENCES fleet_owner(fleet_owner_id) ON DELETE SET NULL,
    user_account_id uuid NOT NULL UNIQUE
        REFERENCES user_account(user_account_id) ON DELETE CASCADE,
    city_id uuid NOT NULL
        REFERENCES city(city_id) ON DELETE RESTRICT,
    verified_by_account_id uuid
        REFERENCES user_account(user_account_id) ON DELETE SET NULL,
    license_number varchar(80) NOT NULL UNIQUE,
    license_expiry_date date NOT NULL,
    driver_status varchar(30) NOT NULL DEFAULT 'PENDING',
    latitude numeric(9,6),
    longitude numeric(9,6)
);
CREATE INDEX idx_driver_fleet_owner_id ON driver(fleet_owner_id);
CREATE INDEX idx_driver_city_id ON driver(city_id);

-- ============================================================
-- 26. VEHICLE ASSIGNMENT
-- ============================================================
CREATE TABLE vehicle_assignment (
    vehicle_assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id uuid NOT NULL
        REFERENCES vehicle(vehicle_id) ON DELETE CASCADE,
    driver_id uuid NOT NULL
        REFERENCES driver(driver_id) ON DELETE CASCADE,
    assigned_by_account_id uuid NOT NULL
        REFERENCES user_account(user_account_id) ON DELETE RESTRICT,
    assignment_status varchar(30) NOT NULL DEFAULT 'ACTIVE',
    assigned_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at timestamptz
);
CREATE INDEX idx_vehicle_assignment_vehicle_id
    ON vehicle_assignment(vehicle_id);
CREATE INDEX idx_vehicle_assignment_driver_id
    ON vehicle_assignment(driver_id);

-- ============================================================
-- 27. FLEET EXPENSE
-- ============================================================
CREATE TABLE fleet_expense (
    fleet_expense_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fleet_owner_id uuid NOT NULL
        REFERENCES fleet_owner(fleet_owner_id) ON DELETE CASCADE,
    vehicle_id uuid
        REFERENCES vehicle(vehicle_id) ON DELETE SET NULL,
    driver_id uuid
        REFERENCES driver(driver_id) ON DELETE SET NULL,
    created_by_account_id uuid NOT NULL
        REFERENCES user_account(user_account_id) ON DELETE RESTRICT,
    approved_by_account_id uuid
        REFERENCES user_account(user_account_id) ON DELETE SET NULL,
    attachment_uploaded_by_account_id uuid
        REFERENCES user_account(user_account_id) ON DELETE SET NULL,
    expense_type varchar(60) NOT NULL,
    amount numeric(12,2) NOT NULL,
    expense_date date NOT NULL,
    approval_status varchar(30) NOT NULL DEFAULT 'PENDING'
);
CREATE INDEX idx_fleet_expense_fleet_owner_id
    ON fleet_expense(fleet_owner_id);
CREATE INDEX idx_fleet_expense_vehicle_id
    ON fleet_expense(vehicle_id);
CREATE INDEX idx_fleet_expense_driver_id
    ON fleet_expense(driver_id);

-- ============================================================
-- 28. LOGISTICS BOOKING DETAIL
-- ============================================================
CREATE TABLE logistics_booking_detail (
    order_id bigint PRIMARY KEY
        REFERENCES orders(order_id) ON DELETE CASCADE,
    vehicle_reference_id uuid
        REFERENCES vehicle(vehicle_id) ON DELETE SET NULL,
    receiver_customer_profile_id uuid
        REFERENCES customer_profile(customer_profile_id) ON DELETE SET NULL,
    receiver_name varchar(150) NOT NULL,
    receiver_phone_number varchar(30) NOT NULL,
    receiver_email varchar(255),
    booking_type varchar(40) NOT NULL,
    booking_locations_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    special_instructions text
);
CREATE INDEX idx_logistics_booking_detail_vehicle_reference_id
    ON logistics_booking_detail(vehicle_reference_id);
CREATE INDEX idx_logistics_booking_detail_receiver_customer_profile_id
    ON logistics_booking_detail(receiver_customer_profile_id);

-- ============================================================
-- 29. TRIP
-- ============================================================
CREATE TABLE trip (
    trip_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id bigint NOT NULL UNIQUE
        REFERENCES orders(order_id) ON DELETE CASCADE,
    vehicle_id uuid NOT NULL
        REFERENCES vehicle(vehicle_id) ON DELETE RESTRICT,
    driver_id uuid NOT NULL
        REFERENCES driver(driver_id) ON DELETE RESTRICT,
    fleet_owner_id uuid NOT NULL
        REFERENCES fleet_owner(fleet_owner_id) ON DELETE RESTRICT,
    created_by_account_id uuid NOT NULL
        REFERENCES user_account(user_account_id) ON DELETE RESTRICT,
    assigned_by_account_id uuid
        REFERENCES user_account(user_account_id) ON DELETE SET NULL,
    trip_number varchar(50) NOT NULL UNIQUE,
    trip_status varchar(30) NOT NULL DEFAULT 'PLANNED',
    planned_start_at timestamptz,
    actual_start_at timestamptz,
    completed_at timestamptz,
    distance_km numeric(10,2),
    proof_of_pickup text,
    proof_of_delivery text
);
CREATE INDEX idx_trip_vehicle_id ON trip(vehicle_id);
CREATE INDEX idx_trip_driver_id ON trip(driver_id);
CREATE INDEX idx_trip_fleet_owner_id ON trip(fleet_owner_id);

-- ============================================================
-- 30. PAYMENT TRANSACTION
-- ============================================================
CREATE TABLE payment_transaction (
    payment_transaction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id bigint NOT NULL
        REFERENCES orders(order_id) ON DELETE RESTRICT,
    provider_reference varchar(120) UNIQUE,
    payment_method varchar(30) NOT NULL,
    payment_status varchar(30) NOT NULL DEFAULT 'PENDING',
    escrow_status varchar(30) NOT NULL DEFAULT 'NOT_HELD',
    held_at timestamptz,
    amount numeric(14,2) NOT NULL,
    currency_code char(3) NOT NULL DEFAULT 'INR',
    processed_at timestamptz
);
CREATE INDEX idx_payment_transaction_order_id
    ON payment_transaction(order_id);

-- ============================================================
-- 31. SETTLEMENT
-- ============================================================
CREATE TABLE settlement (
    settlement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operations_manager_id uuid
        REFERENCES operations_manager(operations_manager_id) ON DELETE SET NULL,
    payment_transaction_id uuid NOT NULL
        REFERENCES payment_transaction(payment_transaction_id) ON DELETE RESTRICT,
    settlement_reference varchar(100) NOT NULL UNIQUE,
    gross_amount numeric(14,2) NOT NULL,
    fee_amount numeric(14,2) NOT NULL DEFAULT 0,
    net_amount numeric(14,2) NOT NULL,
    settlement_status varchar(30) NOT NULL DEFAULT 'PENDING',
    settlement_date date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamptz
);
CREATE INDEX idx_settlement_operations_manager_id
    ON settlement(operations_manager_id);
CREATE INDEX idx_settlement_payment_transaction_id
    ON settlement(payment_transaction_id);

-- ============================================================
-- 32. SUPPORT TICKET
-- ============================================================
CREATE TABLE support_ticket (
    customer_ticket_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Nullable: only set when raised_by_role = 'CUSTOMER'. Retailer/fleet/staff-raised
    -- tickets have no customer_profile row to reference.
    customer_profile_id uuid
        REFERENCES customer_profile(customer_profile_id) ON DELETE RESTRICT,
    order_id bigint
        REFERENCES orders(order_id) ON DELETE SET NULL,
    raised_by_account_id uuid NOT NULL
        REFERENCES user_account(user_account_id) ON DELETE RESTRICT,
    -- Snapshot of the raiser's role at creation time - drives which category/subcategory
    -- taxonomy applied (see SupportTicketCategories on S6) and who a ticket is naturally
    -- routed to; not re-derived from user_account so it survives a role change later.
    raised_by_role varchar(30) NOT NULL DEFAULT 'CUSTOMER',
    ticket_category varchar(50) NOT NULL,
    ticket_sub_category varchar(50) NOT NULL,
    assigned_support_account_id uuid
        REFERENCES user_account(user_account_id) ON DELETE SET NULL,
    ticket_number varchar(50) NOT NULL UNIQUE,
    subject varchar(200) NOT NULL,
    description text NOT NULL,
    priority varchar(20) NOT NULL,
    ticket_status varchar(30) NOT NULL DEFAULT 'OPEN',
    -- Escalation: set when a staff handler cannot resolve the ticket themselves and hands
    -- it to a specific responsible role (SUPER_ADMIN / OPERATIONS_MANAGER / LOCATION_MANAGER).
    escalated_to_role varchar(30),
    escalated_by_account_id uuid
        REFERENCES user_account(user_account_id) ON DELETE SET NULL,
    escalation_reason text,
    escalated_at timestamptz,
    raised_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at timestamptz
);
CREATE INDEX idx_support_ticket_customer_profile_id
    ON support_ticket(customer_profile_id);
CREATE INDEX idx_support_ticket_order_id
    ON support_ticket(order_id);
CREATE INDEX idx_support_ticket_assigned_support_account_id
    ON support_ticket(assigned_support_account_id);
CREATE INDEX idx_support_ticket_escalated_to_role
    ON support_ticket(escalated_to_role);

-- ============================================================
-- 32a. SUPPORT TICKET MESSAGE
-- ============================================================
-- The conversation thread on a ticket - the raiser and any staff handler exchange
-- messages here; is_internal_note marks a staff-only note the raiser never sees.
CREATE TABLE support_ticket_message (
    support_ticket_message_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_ticket_id uuid NOT NULL
        REFERENCES support_ticket(customer_ticket_id) ON DELETE CASCADE,
    sender_account_id uuid NOT NULL
        REFERENCES user_account(user_account_id) ON DELETE RESTRICT,
    sender_role varchar(30) NOT NULL,
    message text NOT NULL,
    is_internal_note boolean NOT NULL DEFAULT false,
    sent_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_support_ticket_message_ticket_id
    ON support_ticket_message(customer_ticket_id);

-- ============================================================
-- 33. CUSTOMER REFUND
-- ============================================================
CREATE TABLE customer_refund (
    customer_refund_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_ticket_id uuid
        REFERENCES support_ticket(customer_ticket_id) ON DELETE SET NULL,
    payment_transaction_id uuid NOT NULL
        REFERENCES payment_transaction(payment_transaction_id) ON DELETE RESTRICT,
    refund_reference varchar(120) UNIQUE,
    refund_amount numeric(14,2) NOT NULL,
    refund_status varchar(30) NOT NULL DEFAULT 'REQUESTED',
    reason text NOT NULL,
    requested_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamptz
);
CREATE INDEX idx_customer_refund_customer_ticket_id
    ON customer_refund(customer_ticket_id);
CREATE INDEX idx_customer_refund_payment_transaction_id
    ON customer_refund(payment_transaction_id);

-- ============================================================
-- 34. TAX CONFIGURATION
-- ============================================================
CREATE TABLE tax_configuration (
    tax_configuration_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tax_category_name varchar(100) NOT NULL,
    description text,
    state_id uuid REFERENCES state(state_id) ON DELETE RESTRICT,
    cgst numeric(6,3) NOT NULL,
    sgst numeric(6,3) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT uq_tax_configuration_category_state_date
        UNIQUE (state_id, tax_category_name, effective_from)
);

COMMIT;
