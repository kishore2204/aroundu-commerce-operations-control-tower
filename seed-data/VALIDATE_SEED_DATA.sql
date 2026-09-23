-- ============================================================================================================
-- AroundU development seed data - validation queries
-- ============================================================================================================
-- Portable SQL (PostgreSQL and H2). All six services share one database, so one script can check every
-- cross-service relationship. Run it after all six services have started and seeded:
--
--     psql -h <host> -U <user> -d <database> -f seed-data/VALIDATE_SEED_DATA.sql
--
-- Part 1 lists the record counts; part 2 must return 0 violations on every row; part 3 shows the money checks.
-- ============================================================================================================

-- ---------------------------------------------------------------- 1. counts -------------------------------
select 'state' as item, count(*) as total from state
union all select 'city', count(*) from city
union all select 'zone', count(*) from zone
union all select 'user_account', count(*) from user_account
union all select 'operations_manager', count(*) from operations_manager
union all select 'location_manager', count(*) from location_manager
union all select 'location_manager_assignment_history', count(*) from location_manager_assignment_history
union all select 'retailer', count(*) from retailer
union all select 'fleet_owner', count(*) from fleet_owner
union all select 'driver', count(*) from driver
union all select 'vehicle', count(*) from vehicle
union all select 'vehicle (two-wheeler BIKE)', count(*) from vehicle where vehicle_type = 'BIKE'
union all select 'vehicle_assignment', count(*) from vehicle_assignment
union all select 'fleet_expense', count(*) from fleet_expense
union all select 'customer_profile', count(*) from customer_profile
union all select 'customer_address', count(*) from customer_address
union all select 'product_categories', count(*) from product_categories
union all select 'products', count(*) from products
union all select 'customer_cart (lines)', count(*) from customer_cart
union all select 'customer_cart_item', count(*) from customer_cart_item
union all select 'customer_wishlist_item', count(*) from customer_wishlist_item
union all select 'orders', count(*) from orders
union all select 'order_item', count(*) from order_item
union all select 'trip', count(*) from trip
union all select 'trip_status_history', count(*) from trip_status_history
union all select 'logistics_booking_detail', count(*) from logistics_booking_detail
union all select 'customer_review', count(*) from customer_review
union all select 'verification_queue', count(*) from verification_queue
union all select 'verification_document', count(*) from verification_document
union all select 'payment_transaction', count(*) from payment_transaction
union all select 'customer_invoice', count(*) from customer_invoice
union all select 'settlement', count(*) from settlement
union all select 'customer_refund', count(*) from customer_refund
union all select 'support_ticket', count(*) from support_ticket
union all select 'support_ticket_message', count(*) from support_ticket_message
union all select 'ticket_cluster_incident', count(*) from ticket_cluster_incident
union all select 'notifications', count(*) from notifications
union all select 'audit_log', count(*) from audit_log
union all select 'tax_configuration', count(*) from tax_configuration
union all select 'tax_configuration (active)', count(*) from tax_configuration where active = true
order by 1;

-- ---------------------------------------------------------------- 2. integrity / business rules ---------
-- every row must show violations = 0
select 'exactly 4 zones' as rule, case when (select count(*) from zone) = 4 then 0 else 1 end as violations
union all select 'zone names are North/South/East/West', count(*) from zone where zone_name not in ('North', 'South', 'East', 'West')
union all select 'every city has a state', count(*) from city c where not exists (select 1 from state s where s.state_id = c.state_id)
union all select 'every zone has a city', count(*) from zone z where not exists (select 1 from city c where c.city_id = z.city_id)
union all select 'password is BCrypt (delegating encoder)', count(*) from user_account where password_hash not like '{bcrypt}%'
union all select 'phone numbers are exactly 10 digits', count(*) from user_account where length(phone_number) <> 10
union all select 'operations manager -> account + city', count(*) from operations_manager o
    where not exists (select 1 from user_account u where u.user_account_id = o.user_account_id) or not exists (select 1 from city c where c.city_id = o.city_id)
union all select 'location manager -> account + zone + operations manager of the same city', count(*) from location_manager l
    where not exists (select 1 from zone z join operations_manager o on o.city_id = z.city_id where z.zone_id = l.zone_id and o.operations_manager_id = l.operations_manager_id)
union all select 'retailer -> account, city, zone in that city', count(*) from retailer r
    where not exists (select 1 from user_account u where u.user_account_id = r.user_account_id and u.role = 'RETAILER')
       or not exists (select 1 from zone z where z.zone_id = r.zone_id and z.city_id = r.city_id)
union all select 'retailer GSTIN is 15 characters', count(*) from retailer where length(gst_number) <> 15
union all select 'fleet owner -> account, city, zone in that city', count(*) from fleet_owner f
    where not exists (select 1 from user_account u where u.user_account_id = f.user_account_id and u.role = 'FLEET_MANAGER')
       or not exists (select 1 from zone z where z.zone_id = f.zone_id and z.city_id = f.city_id)
union all select 'every fleet owner has exactly 3 drivers', count(*) from fleet_owner f where (select count(*) from driver d where d.fleet_owner_id = f.fleet_owner_id) <> 3
union all select 'every fleet owner has 3 four-wheelers and a two-wheeler', count(*) from fleet_owner f
    where (select count(*) from vehicle v where v.fleet_owner_id = f.fleet_owner_id and v.vehicle_type in ('MINI_TRUCK', 'TRUCK')) <> 3
       or (select count(*) from vehicle v where v.fleet_owner_id = f.fleet_owner_id and v.vehicle_type = 'BIKE') <> 1
union all select 'driver -> account (DRIVER) + fleet owner', count(*) from driver d
    where not exists (select 1 from user_account u where u.user_account_id = d.user_account_id and u.role = 'DRIVER')
       or not exists (select 1 from fleet_owner f where f.fleet_owner_id = d.fleet_owner_id)
union all select 'vehicle -> fleet owner', count(*) from vehicle v where not exists (select 1 from fleet_owner f where f.fleet_owner_id = v.fleet_owner_id)
union all select 'assignment: driver and vehicle belong to the same fleet owner', count(*) from vehicle_assignment a
    where not exists (select 1 from driver d join vehicle v on v.fleet_owner_id = d.fleet_owner_id where d.driver_id = a.driver_id and v.vehicle_id = a.vehicle_id)
union all select 'at most one ACTIVE assignment per driver', count(*) from (select driver_id from vehicle_assignment where assignment_status = 'ACTIVE' group by driver_id having count(*) > 1) x
union all select 'at most one ACTIVE assignment per vehicle', count(*) from (select vehicle_id from vehicle_assignment where assignment_status = 'ACTIVE' group by vehicle_id having count(*) > 1) x
union all select 'assignment cargo fits the vehicle', count(*) from vehicle_assignment a join vehicle v on v.vehicle_id = a.vehicle_id where a.cargo_weight_kg > v.capacity_kg
union all select 'expense -> fleet owner + vehicle of that fleet', count(*) from fleet_expense e
    where not exists (select 1 from vehicle v where v.vehicle_id = e.vehicle_id and v.fleet_owner_id = e.fleet_owner_id)
union all select 'expense amount within 0 < x <= 10000', count(*) from fleet_expense where amount <= 0 or amount > 10000
union all select 'expense approver is not its creator', count(*) from fleet_expense where approved_by_account_id = created_by_account_id
union all select 'customer -> account (CUSTOMER)', count(*) from customer_profile c where not exists (select 1 from user_account u where u.user_account_id = c.user_account_id and u.role = 'CUSTOMER')
union all select 'every customer has exactly 2 addresses', count(*) from customer_profile c where (select count(*) from customer_address a where a.customer_profile_id = c.customer_profile_id) <> 2
union all select 'the 2 addresses of a customer are in different zones', count(*) from customer_profile c where (select count(distinct a.zone_id) from customer_address a where a.customer_profile_id = c.customer_profile_id) <> 2
union all select 'every customer has exactly 1 default address', count(*) from customer_profile c where (select count(*) from customer_address a where a.customer_profile_id = c.customer_profile_id and a.is_default = true) <> 1
union all select 'address zone belongs to its city', count(*) from customer_address a where not exists (select 1 from zone z where z.zone_id = a.zone_id and z.city_id = a.city_id)
union all select 'address postal code is 6 digits', count(*) from customer_address where length(postal_code) <> 6
union all select 'all four zones are used by customer addresses', case when (select count(distinct zone_id) from customer_address) = 4 then 0 else 1 end
union all select 'product -> category (no orphan)', count(*) from products p where not exists (select 1 from product_categories c where c.category_id = p.category_id)
union all select 'product -> retailer (no orphan)', count(*) from products p where not exists (select 1 from retailer r where r.retailer_id = p.retailer_id)
union all select 'product only in an ACTIVE category, or unchanged', count(*) from products p join product_categories c on c.category_id = p.category_id where c.status <> 'ACTIVE'
union all select 'product stock >= 0', count(*) from products where stock_quantity < 0
union all select 'product SKU pattern [A-Za-z0-9_-]{3,20}', count(*) from products where length(sku) < 3 or length(sku) > 20
union all select 'product description 10..300 characters', count(*) from products where length(description) < 10 or length(description) > 300
union all select 'every category is used by a product (ACTIVE ones)', count(*) from product_categories c where c.status = 'ACTIVE' and not exists (select 1 from products p where p.category_id = c.category_id)
union all select 'every ACTIVE category has an active tax rule in every state', count(*) from product_categories c cross join state s
    where c.status = 'ACTIVE' and not exists (select 1 from tax_configuration t where t.product_category_id = c.category_id and t.state_id = s.state_id and t.active = true)
union all select 'tax rule -> category + state', count(*) from tax_configuration t
    where not exists (select 1 from product_categories c where c.category_id = t.product_category_id) or not exists (select 1 from state s where s.state_id = t.state_id)
union all select 'no two active tax rules for the same category + state', count(*) from (select product_category_id, state_id from tax_configuration where active = true group by product_category_id, state_id having count(*) > 1) x
union all select 'cart line -> customer + product + retailer of the product', count(*) from customer_cart c
    where not exists (select 1 from customer_cart_item i join products p on p.product_id = c.product_id where i.cart_id = c.cart_id and i.retailer_id = p.retailer_id)
union all select 'a single-retailer and a multi-retailer cart exist', case when (select count(*) from (select customer_profile_id from customer_cart c join customer_cart_item i on i.cart_id = c.cart_id group by customer_profile_id having count(distinct i.retailer_id) > 1) x) >= 1
    and (select count(*) from (select customer_profile_id from customer_cart c join customer_cart_item i on i.cart_id = c.cart_id group by customer_profile_id having count(distinct i.retailer_id) = 1) x) >= 1 then 0 else 1 end
union all select 'wishlist -> customer + product', count(*) from customer_wishlist_item w
    where not exists (select 1 from customer_profile c where c.customer_profile_id = w.customer_profile_id) or not exists (select 1 from products p where p.product_id = w.product_id)
union all select 'order -> customer', count(*) from orders o where not exists (select 1 from customer_profile c where c.customer_profile_id = o.customer_profile_id)
union all select 'RETAIL order has items of ONE retailer (one order per retailer)', count(*) from orders o
    where o.order_type = 'RETAIL' and (select count(distinct retailer_id) from order_item i where i.order_id = o.order_id) <> 1
union all select 'order item -> product of the same retailer', count(*) from order_item i
    where not exists (select 1 from products p where p.product_id = i.product_id and p.retailer_id = i.retailer_id and p.sku = i.sku_snapshot)
union all select 'a multi-retailer checkout exists (same customer + moment, 2 orders)', case when (select count(*) from (select customer_profile_id, order_date from orders where order_type = 'RETAIL' group by customer_profile_id, order_date having count(*) > 1) x) >= 1 then 0 else 1 end
union all select 'order item line total = quantity x unit price', count(*) from order_item where line_total <> quantity * unit_price
union all select 'order subtotal = sum of line totals (RETAIL)', count(*) from orders o where o.order_type = 'RETAIL' and o.subtotal_amount <> (select sum(line_total) from order_item i where i.order_id = o.order_id)
union all select 'order total = subtotal + delivery + tax + platform fee - discount', count(*) from orders where total_amount <> subtotal_amount + delivery_charge + tax_amount + platform_fee_amount - discount_amount
union all select 'platform fee = 2% of the subtotal (RETAIL)', count(*) from orders where order_type = 'RETAIL' and platform_fee_amount <> round(subtotal_amount * 0.02, 2)
union all select 'order tax = per-line tax of the category in the delivery state (RETAIL)', count(*) from orders o
    where o.order_type = 'RETAIL' and o.tax_amount <> (
        select sum(round(i.quantity * i.unit_price * (t.cgst + t.sgst) / 100, 2)) from order_item i
        join products p on p.product_id = i.product_id
        join customer_address a on a.customer_profile_id = o.customer_profile_id and o.delivery_address like a.address_line_1 || '%'
        join city c on c.city_id = a.city_id
        join tax_configuration t on t.product_category_id = p.category_id and t.state_id = c.state_id and t.active = true
        where i.order_id = o.order_id)
union all select 'delivery address of an order is one of the customer''s addresses', count(*) from orders o
    where o.order_type = 'RETAIL' and not exists (select 1 from customer_address a where a.customer_profile_id = o.customer_profile_id and o.delivery_address like a.address_line_1 || '%')
union all select 'order statuses are valid', count(*) from orders where order_status not in ('NEW', 'WAITING_FOR_RETAILER', 'RETAILER_ACCEPTED', 'RETAILER_REJECTED', 'FINDING_DELIVERY_PARTNER', 'BOOKING_CONFIRMED', 'VEHICLE_ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'SHOP_UNAVAILABLE')
union all select 'DELIVERED / IN_TRANSIT / VEHICLE_ASSIGNED retail orders have exactly one trip', count(*) from orders o
    where o.order_type = 'RETAIL' and o.order_status in ('DELIVERED', 'IN_TRANSIT', 'VEHICLE_ASSIGNED') and (select count(*) from trip t where t.order_id = o.order_id) <> 1
union all select 'order status matches its trip status', count(*) from orders o join trip t on t.order_id = o.order_id
    where not ((t.trip_status = 'COMPLETED' and o.order_status = 'DELIVERED') or (t.trip_status = 'IN_PROGRESS' and o.order_status = 'IN_TRANSIT') or (t.trip_status = 'PLANNED' and o.order_status = 'VEHICLE_ASSIGNED'))
union all select 'trip: driver + vehicle + fleet owner belong together', count(*) from trip t
    where not exists (select 1 from driver d join vehicle v on v.fleet_owner_id = d.fleet_owner_id where d.driver_id = t.driver_id and v.vehicle_id = t.vehicle_id and d.fleet_owner_id = t.fleet_owner_id)
union all select 'trip: vehicle capacity >= order weight', count(*) from trip t join vehicle v on v.vehicle_id = t.vehicle_id
    where (select coalesce(sum(i.quantity * i.weight_kg_snapshot), 0) from order_item i where i.order_id = t.order_id) > v.capacity_kg
union all select 'trip: driver is the ACTIVE / historical assignee of the vehicle', count(*) from trip t
    where not exists (select 1 from vehicle_assignment a where a.driver_id = t.driver_id and a.vehicle_id = t.vehicle_id)
union all select 'trip status history: PLANNED -> IN_PROGRESS -> COMPLETED in time order', count(*) from trip_status_history h
    where h.from_status is not null and h.changed_at < (select h2.changed_at from trip_status_history h2 where h2.trip_id = h.trip_id and h2.to_status = h.from_status)
union all select 'trip completed after it started, started after it was planned', count(*) from trip
    where (actual_start_at is not null and actual_start_at < planned_start_at) or (completed_at is not null and completed_at < actual_start_at)
union all select 'FLEET_SERVICE order has a logistics booking with a vehicle', count(*) from orders o
    where o.order_type = 'FLEET_SERVICE' and not exists (select 1 from logistics_booking_detail b join vehicle v on v.vehicle_id = b.vehicle_reference_id where b.order_id = o.order_id)
union all select 'review -> delivered order of that customer containing the product', count(*) from customer_review r
    where not exists (select 1 from orders o join order_item i on i.order_id = o.order_id
        where o.order_id = r.order_id and o.customer_profile_id = r.customer_id and i.product_id = r.product_id and o.order_status = 'DELIVERED')
union all select 'review rating 1..5', count(*) from customer_review where rating < 1 or rating > 5
union all select 'stock = opening stock minus ordered quantity (non-cancelled orders): no negative stock', count(*) from products where stock_quantity < 0
union all select 'verification queue -> subject exists', count(*) from verification_queue q
    where not ((q.subject_type = 'RETAILER' and exists (select 1 from retailer r where r.retailer_id = q.subject_id))
        or (q.subject_type = 'FLEET_OWNER' and exists (select 1 from fleet_owner f where f.fleet_owner_id = q.subject_id))
        or (q.subject_type = 'DRIVER' and exists (select 1 from driver d where d.driver_id = q.subject_id))
        or (q.subject_type = 'VEHICLE' and exists (select 1 from vehicle v where v.vehicle_id = q.subject_id)))
union all select 'every retailer / fleet owner / driver / vehicle has an APPROVED verification queue', count(*) from (
        select retailer_id as id from retailer union all select fleet_owner_id from fleet_owner union all select driver_id from driver union all select vehicle_id from vehicle) s
    where not exists (select 1 from verification_queue q where q.subject_id = s.id and q.verification_status = 'APPROVED')
union all select 'approved queue has all required current documents approved', count(*) from verification_queue q
    where q.verification_status = 'APPROVED' and (
        (q.subject_type = 'RETAILER' and (select count(*) from verification_document d where d.verification_queue_id = q.verification_queue_id and d.is_current_version = true and d.document_status = 'APPROVED') <> 4)
     or (q.subject_type = 'FLEET_OWNER' and (select count(*) from verification_document d where d.verification_queue_id = q.verification_queue_id and d.is_current_version = true and d.document_status = 'APPROVED') <> 2)
     or (q.subject_type in ('DRIVER', 'VEHICLE') and (select count(*) from verification_document d where d.verification_queue_id = q.verification_queue_id and d.is_current_version = true and d.document_status = 'APPROVED') <> 1))
union all select 'verification document has file content and size', count(*) from verification_document where file_content is null or file_size_bytes is null
union all select 'payment -> order, amount = order total (SUCCESS)', count(*) from payment_transaction p
    where p.payment_status = 'SUCCESS' and not exists (select 1 from orders o where o.order_id = p.order_id and o.total_amount = p.amount and o.payment_status = 'PAID')
union all select 'payment reference = order transaction reference (SUCCESS)', count(*) from payment_transaction p join orders o on o.order_id = p.order_id where p.payment_status = 'SUCCESS' and p.provider_reference <> o.transaction_reference
union all select 'PAID order has a SUCCESS payment', count(*) from orders o where o.payment_status = 'PAID' and not exists (select 1 from payment_transaction p where p.order_id = o.order_id and p.payment_status = 'SUCCESS')
union all select 'escrow RELEASED exactly for DELIVERED orders', count(*) from payment_transaction p join orders o on o.order_id = p.order_id
    where p.payment_status = 'SUCCESS' and ((p.escrow_status = 'RELEASED') <> (o.order_status = 'DELIVERED'))
union all select 'at most one SUCCESS payment per order', count(*) from (select order_id from payment_transaction where payment_status = 'SUCCESS' group by order_id having count(*) > 1) x
union all select 'invoice -> delivered retail order; total = subtotal + tax', count(*) from customer_invoice i
    where not exists (select 1 from orders o where o.order_id = i.order_id and o.order_status = 'DELIVERED') or i.total_amount <> i.subtotal_amount + i.tax_amount
union all select 'every delivered retail order has an invoice', count(*) from orders o where o.order_type = 'RETAIL' and o.order_status = 'DELIVERED' and not exists (select 1 from customer_invoice i where i.order_id = o.order_id)
union all select 'settlement -> payment; net = gross - fee', count(*) from settlement s
    where not exists (select 1 from payment_transaction p where p.payment_transaction_id = s.payment_transaction_id) or s.net_amount <> s.gross_amount - s.fee_amount
union all select 'settlements of an order add up to its total + discount', count(*) from payment_transaction p join orders o on o.order_id = p.order_id
    where o.order_status = 'DELIVERED' and (select sum(gross_amount) from settlement s where s.payment_transaction_id = p.payment_transaction_id) <> o.total_amount + o.discount_amount
union all select 'RETAILER settlement -> retailer, FLEET_OWNER settlement -> fleet owner', count(*) from settlement s
    where (s.payee_type = 'RETAILER' and not exists (select 1 from retailer r where r.retailer_id = s.payee_id))
       or (s.payee_type = 'FLEET_OWNER' and not exists (select 1 from fleet_owner f where f.fleet_owner_id = s.payee_id))
union all select 'refund -> ticket + payment + order item; amount <= item line total', count(*) from customer_refund r
    where not exists (select 1 from support_ticket t where t.customer_ticket_id = r.customer_ticket_id)
       or not exists (select 1 from payment_transaction p where p.payment_transaction_id = r.payment_transaction_id)
       or not exists (select 1 from order_item i where i.order_item_id = r.order_item_id and i.line_total >= r.refund_amount)
union all select 'ticket -> raiser account; customer ticket -> customer + own order', count(*) from support_ticket t
    where not exists (select 1 from user_account u where u.user_account_id = t.raised_by_account_id)
       or (t.raised_by_role = 'CUSTOMER' and (t.customer_profile_id is null or (t.order_id is not null and not exists (select 1 from orders o where o.order_id = t.order_id and o.customer_profile_id = t.customer_profile_id))))
union all select 'ticket message -> ticket, sent after the ticket was raised', count(*) from support_ticket_message m
    where not exists (select 1 from support_ticket t where t.customer_ticket_id = m.customer_ticket_id and m.sent_at >= t.raised_at)
union all select 'resolved / closed ticket has resolved_at; open one does not', count(*) from support_ticket where ((ticket_status in ('RESOLVED', 'CLOSED')) <> (resolved_at is not null))
union all select 'cluster incident: tickets exist, same category / zone', count(*) from ticket_cluster_incident c
    where (select count(*) from support_ticket t where t.cluster_incident_id = c.cluster_incident_id) <> c.ticket_count
       or (select count(distinct t.raised_by_account_id) from support_ticket t where t.cluster_incident_id = c.cluster_incident_id) <> c.distinct_raiser_count
union all select 'notification -> user account', count(*) from notifications n where not exists (select 1 from user_account u where u.user_account_id = n.user_account_id)
union all select 'audit log -> user account', count(*) from audit_log a where not exists (select 1 from user_account u where u.user_account_id = a.user_account_id)
union all select 'no two accounts share an email or phone', count(*) from (select email from user_account group by email having count(*) > 1) x
union all select 'nothing dated after the dataset moment (2026-09-20 18:00 IST)', count(*) from orders where order_date > timestamp '2026-09-20 18:00:00'
union all select 'no legacy seed accounts (@aroundu.local) remain', count(*) from user_account where email like '%aroundu.local'
order by 1;

-- ---------------------------------------------------------------- 3. money overview ---------------------
select o.order_type, o.order_status, count(*) as orders, sum(o.subtotal_amount) as subtotal, sum(o.tax_amount) as tax,
       sum(o.delivery_charge) as delivery, sum(o.platform_fee_amount) as platform_fee, sum(o.discount_amount) as discount, sum(o.total_amount) as total
from orders o group by o.order_type, o.order_status order by 1, 2;
