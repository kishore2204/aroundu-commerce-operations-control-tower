# AroundU — Full Application Workflow & Role Journeys

## 1. Source and scope

This document is derived from the supplied AroundU UI wireframes/prototype files. It maps the visible screens, actions and workflows to the six-service backend architecture already defined by the team.

The product has two major customer journeys:

1. **Retail commerce** — customers discover products from nearby local retailers/Kirana stores, add them to a cart and place an order.
2. **Logistics** — customers book a vehicle (for example, two-wheeler or truck), provide pickup/drop/receiver details, select a vehicle and complete payment.

The logistics flow is explicitly seven steps in the wireframes:

**Service → Service Type → Locations → Receiver → Vehicle → Payment → Tracking**

The UI also contains workspaces for Customer, Retailer, Driver, Fleet/Operations, Verification/Location Manager and Super Admin.

---

# 2. High-level system journey

```text
User enters AroundU
        |
        v
Role-based Login / Signup
        |
        +---------------- CUSTOMER ----------------+
        |                                           |
        |          +----------------------+         |
        |          | Retail Commerce      |         |
        |          | Search               |         |
        |          | Product              |         |
        |          | Wishlist             |         |
        |          | Cart                 |         |
        |          | Checkout             |         |
        |          | Payment              |         |
        |          | Order / Tracking     |         |
        |          +----------------------+         |
        |                                           |
        |          +----------------------+         |
        |          | Logistics            |         |
        |          | Service              |         |
        |          | Service Type         |         |
        |          | Pickup / Drop        |         |
        |          | Receiver             |         |
        |          | Vehicle              |         |
        |          | Payment              |         |
        |          | Live Tracking        |         |
        |          +----------------------+         |
        |                                           |
        +-------------------------------------------+
        |
        +---- RETAILER
        |       Onboarding → Verification
        |       Store → Catalogue → Inventory
        |       Orders → Fulfilment → Finance
        |
        +---- DRIVER
        |       Login → Readiness → Assignment
        |       Pickup → OTP → Transit → Delivery
        |       Earnings → Trips → Support
        |
        +---- LOCATION / VERIFICATION MANAGER
        |       Dashboard → Retailer Verification
        |       Fleet/Driver/Vehicle Verification
        |       Location Management → Reports/Finance
        |
        +---- OPERATIONS MANAGER
        |       Dashboard → Officers
        |       Verification Queue → Stores
        |       Settlements → Tax → Insights
        |       Messages → Audit
        |
        +---- SUPPORT ADMIN
        |       Ticket Queue → Customer/User Communication
        |       Evidence Verification → Resolve / Escalate
        |
        +---- SUPER ADMIN
                Dashboard → Users/Managers
                Vendors → Orders
                Payments → Support → Analytics
```

---

# 3. Customer — Retail Commerce Journey

## 3.1 Entry

1. Customer opens AroundU.
2. Customer logs in using username/email/mobile + password.
3. Backend authenticates the customer and returns a JWT.
4. Customer is taken to the customer workspace.

## 3.2 Home

Customer sees:

- Search
- Delivery location
- Categories
- Recommended products
- Deals
- Trending products
- Orders
- Wishlist
- Cart

The selected shopping location is used to determine relevant local products/retailers.

## 3.3 Search

Customer:

1. Enters product/search term.
2. Backend searches the catalogue.
3. Results can be filtered by:
   - Category
   - Retailer
   - Availability
   - Fast delivery
4. Results can be sorted by:
   - Relevance
   - Price low → high
   - Price high → low
   - Highest rated
   - Fastest delivery

## 3.4 Product Details

Customer opens a product.

Screen shows:

- Product
- Brand
- Category
- Price
- Discount
- Rating
- Reviews
- Availability
- Delivery estimate
- Selected delivery location
- Verified retailer
- Quantity
- Add to Cart
- Buy Now
- Add to Wishlist

The backend must return enough catalogue + retailer information for this screen.

Every customer commerce product card must identify its Shop/Retailer. The retailer name is clickable and opens/expands retailer details using the same UI pattern as the AroundU home UI, including shop name, rating, verification status, location/address and contact/details where available. This behavior applies consistently across Home, Search, Category, Recommendations, Wishlist and other product listing screens. A product must not be displayed without identifying its associated retailer.

## 3.5 Wishlist

Customer can:

- View wishlist
- Remove product
- Add product to cart
- See availability
- Sort/filter wishlist
- See recommendations

## 3.6 Cart

Customer:

1. Opens cart.
2. Reviews products.
3. Adjusts quantity.
4. Removes items.
5. Selects delivery address.
6. Applies coupon where supported.
7. Reviews total.
8. Proceeds to payment.

Before payment, the backend should re-check product availability/stock.

## 3.7 Retail Payment / Checkout

Customer reviews:

- Items
- Retailer
- Address
- Item subtotal
- Delivery charge
- Discount
- Tax where applicable
- Final payable amount
- Payment method

Payment options shown by the prototype include:

- Card
- UPI
- Wallet
- Net Banking
- Cash on Delivery

The backend should not trust the amount sent by the browser; it should calculate/validate the final payable amount server-side.

## 3.8 Retail Order

After successful checkout:

1. Payment is processed/recorded.
2. Order is created.
3. Order items are stored.
4. Stock is reserved/decremented according to the existing business rule.
5. Retailer receives the order.
6. Customer receives confirmation.
7. Customer can track the order.

## 3.9 Retail Order History

Customer can:

- Search orders
- Filter by status
- Filter by date
- Sort
- Open order details
- Reorder
- Request return
- Request replacement
- Download/view invoice
- Contact support

## 3.10 Retail Tracking

Customer sees:

- Order ID
- Tracking reference
- Current status
- Payment status
- Items
- Delivery progress
- Delivery window
- Driver/delivery partner information where available
- Report issue

---

# 4. Customer — Logistics Journey

## Step 1 — Service

Customer chooses what to book:

### Truck
For:
- Furniture
- Appliances
- Commercial goods
- Large shipments
- Heavy loads

### Two Wheeler
For:
- Documents
- Parcels
- Medicines
- Lightweight packages

## Step 2 — Service Type

Customer chooses:

- Within City
- Outstation

## Step 3 — Locations

Customer provides:

- Pickup location
- Drop location

Can select from saved addresses.

Backend calculates/returns route-related information such as distance where supported.

## Step 4 — Receiver

Customer enters:

- Receiver name
- Receiver phone
- Flat/floor/door
- Landmark
- Other receiver details shown in the form

## Step 5 — Vehicle

Backend provides available vehicle options.

UI compares:

- Vehicle type
- Capacity
- Cargo suitability
- Arrival time
- Estimated fare

Customer selects a vehicle.

For the wireframe, examples include:

- Bike / Two Wheeler
- Tata Ace / Truck-type option
- Other suitable vehicle sizes

## Step 6 — Payment

Customer reviews:

- Service
- Vehicle
- Route
- Distance
- Fare

Payment modes shown include:

- Cash by sender
- Cash by receiver
- Online payment
  - UPI
  - Card
  - Wallet

Booking should not be considered confirmed until the backend successfully records the booking/payment state.

## Step 7 — Tracking

Customer sees:

- Booking ID
- Current status
- ETA
- Remaining distance where available
- Timeline
- Driver
- Vehicle
- Driver contact/call action
- Get Help

Typical lifecycle shown:

```text
Booking Confirmed
      ↓
Driver Assigned
      ↓
Goods Picked Up
      ↓
In Transit
      ↓
Delivered
```

---

# 5. Customer — Support

Customer can:

- Search help
- Read FAQs
- Start support chat
- Contact support
- Create support ticket
- Report payment issue
- Report order issue
- Report delivery issue
- Report return/refund issue
- View ticket transcript
- Continue conversation
- Provide requested evidence/proof when Support Admin asks for it
- See the support resolution, rejection or escalation status

---

# 6. Customer — Profile / Notifications

Customer profile supports:

- View/edit personal information
- Mobile
- Email
- City
- Default address
- Delivery preferences
- Booking notifications
- Promotional notifications
- Logout

Notifications cover:

- Booking updates
- Payment updates
- Driver alerts
- Offers/promotions

---

# 7. Retailer Journey

## 7.1 Registration / Onboarding

Retailer:

1. Creates account.
2. Provides business/store information.
3. Provides required documents.
4. Submits onboarding.
5. Verification request is created.
6. Location/verification authority reviews documents.
7. Retailer is approved, rejected or asked to resubmit.

## 7.2 Retailer Dashboard

After approval retailer sees:

- Sales overview
- Recent orders
- Inventory alerts
- Low stock
- Out-of-stock products
- Recent reviews
- Quick actions

## 7.3 Catalogue

Retailer can:

- View products
- Add product
- Update product
- Delete/deactivate product
- Set SKU
- Select category
- Set price
- Add description
- Upload product image
- Change product status

## 7.4 Inventory

Retailer can:

- View inventory
- Search product/SKU
- See low-stock items
- See out-of-stock items
- Adjust quantity
- Export inventory

## 7.5 Orders

Retailer can:

- View orders
- Filter/search
- Open order details
- Update order status
- Process fulfilment
- Handle cancellation
- Review returns
- Handle replacement decisions

The visible lifecycle includes states such as:

```text
New
→ Processing
→ Packed
→ Dispatched
→ Delivered
```

plus cancellation/return states.

## 7.6 Store Management

Retailer can manage:

- Store profile
- Business information
- Store location
- Operating hours
- Store documents
- Store image
- Request profile/document changes
- Take a break / operating status

## 7.7 Finance

Retailer can:

- View settlement summary
- View settlement history
- View payout history
- Search finance history
- Update settlement bank account

## 7.8 Retailer Support

Retailer can:

- Create support ticket
- Select issue type
- Set priority
- Enter subject
- Enter description
- Attach evidence
- View tickets
- Add information

Support requests are routed to the Support Admin for review and resolution. The Support Admin may resolve the issue directly or escalate it to the appropriate admin/operations role when the issue requires action outside support.

---

# 8. Driver Journey

## 8.1 Login / Home

Driver logs in and sees:

- Readiness
- Assigned vehicle
- Recent trip
- Next settlement
- Notifications

## 8.2 Driver Readiness

Driver's operational status should be represented so the fleet system can determine whether the driver can be assigned.

## 8.3 Assigned Order

Driver receives an assigned delivery.

Driver can:

1. Open assignment.
2. View pickup.
3. Start navigation.
4. Mark arrived.
5. Perform pickup inspection.
6. Upload evidence/photos.
7. Verify pickup OTP.
8. Confirm pickup.
9. Acknowledge and start delivery.

## 8.4 In Transit

Driver sees:

- Destination
- Receiver
- Current task
- Navigation
- Mark arrived

## 8.5 Delivery Completion

Driver:

1. Reaches destination.
2. Marks arrived.
3. Confirms receiver.
4. Handles collection if applicable.
5. Uploads delivery evidence.
6. Completes delivery.

## 8.6 Driver Earnings

Driver sees:

- Earnings
- Weekly performance
- Target
- Cash reconciliation
- Trip earnings
- Incentives
- Adjustments
- Settlement activity

The existing 34-entity schema does not contain a dedicated earnings/incentive entity, so this part requires either derived data from existing entities or additional persistence if the team wants it fully transactional.

## 8.7 Driver Trips

Driver can:

- View current trips
- View completed trips
- Open trip details

## 8.8 Driver Support

Driver can:

- Start support chat
- Call support
- View safety guidance
- Create support request

Support requests are routed to the Support Admin for review and resolution. The Support Admin may resolve the issue directly or escalate it to the appropriate admin/operations role when required.

---

# 9. Fleet / Operations Journey

The supplied UI has a Fleet Manager workspace containing:

- Dashboard
- Analytics
- Assignments
- Vehicles
- Drivers
- Trips
- Maintenance
- Finance
- Documents/compliance
- Notifications
- Profile
- Support

## Vehicle management

Fleet operator can:

- Register vehicle
- Search vehicles
- View vehicle details
- Filter vehicles
- Export vehicle data

## Driver management

Fleet operator can:

- Add driver
- Search drivers
- View driver details
- View verification state
- Associate driver information with operations

## Assignment management

Fleet operator can:

- View assignments
- Search assignments
- Allocate driver/vehicle
- Review assignment state

## Trips

Fleet operator can:

- View ongoing trips
- View completed trips
- View cancelled trips
- Open trip details

## Fleet expenses

Fleet operator can:

- Assign salary/expense
- Select driver or vehicle
- Select month
- Enter amount
- Add note
- Export finance information

## Maintenance

The wireframe supports:

- Add maintenance task
- Existing vehicle
- Maintenance detail
- Service centre
- Date
- Estimated cost

IMPORTANT:
The current 34-entity backend does not contain a dedicated maintenance entity. Do not silently claim this is persisted by S5 unless the existing code supports it.

## Compliance

The wireframe supports compliance tasks. Again, verify whether this is backed by existing entities before implementing persistence.

---

# 10. Verification / Location Manager Journey

The supplied prototype has a verification workspace covering:

- Fleet owners
- Drivers
- Vehicles
- Verification queue
- Verification history
- Uploaded documents
- Verification decisions

Typical flow:

```text
Pending submission
      ↓
Open verification
      ↓
Review entity details
      ↓
Review uploaded documents
      ↓
Approve
   OR
Request resubmission
   OR
Suspend/Delete administrative access
```

The reviewer can:

- Search
- Filter
- Open owner
- Open fleet
- Open driver
- Open vehicle
- Preview documents
- Download documents
- Request resubmission
- Approve
- Suspend
- Delete where authorised
- Review verification history

The Location Manager prototype additionally contains:

- Location Command Center
- Retailer Management
- Retailer Verification
- Finance Command Center
- Reports
- Profile

Location Command Center supports:

- Add location
- Search
- Zone filter
- View location
- Export locations
- Expansion report
- Coverage recommendation

IMPORTANT:
The supplied location-manager ER documentation proposes additional entities such as LOCATION, LOCATION_STATUS, LOCATION_RECOMMENDATION and EXPANSION_REPORT. Those are NOT among the current 34 entities described by the six-service backend. Therefore this workflow is a UI requirement/gap, not an existing 34-entity backend capability.

---

# 11. Operations Manager Journey

Operations Manager portal supports:

- Dashboard
- Officers
- Verification queue
- Store directory
- Finance & escrow
- Settlements
- Tax configuration
- Operations insights
- Messages
- Audit logs
- Profile
- Notifications

## Officer management

Operations Manager can create/manage:

- Location managers
- Service officers
- Truck officers

Forms include:

- Name
- Mobile
- Email
- City
- Zone
- Role-specific information
- Username
- Password

## Verification queue

Operations Manager can:

- Search verification workload
- Review queue
- Select action
- Select suitable officer
- Enter reason
- Add manager note
- Apply action

## Store oversight

Operations Manager can:

- Search stores
- View stores
- Review stores
- Apply actions

## Finance / Escrow

Operations Manager can:

- Review escrow information
- Apply finance actions
- Confirm actions
- Manage settlements

## Tax

Operations Manager can configure:

- Category
- CGST
- SGST
- IGST
- Effective date

## Operations insights

Supports:

- Incidents
- Zone analysis
- Problem sources
- Recommendations
- Trends
- Resolution health
- Generate incident report
- Export data
- Assign
- Request action
- Send insight notifications to Location Managers and relevant retailers

## Messages

Operations Manager can:

- Search conversations
- Select recipient
- Send messages
- View notifications

## Audit

Operations Manager can view audit logs.

---

# 12. Support Admin Journey

The Support Admin is the primary support owner for tickets raised by customers and other operational users. The supplied `customer_support` UI represents this role as a ticket-resolution workspace with a dashboard, ticket queue and ticket-detail resolution workflow.

## 12.1 Ticket intake and queue

Support Admin receives support tickets from:

- Customers
- Retailers
- Drivers / delivery partners
- Other users/operational roles where the application routes a support request

The support workspace supports:

- Dashboard with ticket workload and resolution progress
- Ticket queue
- Search/filter by ticket status and category
- Open ticket details
- Customer communication
- Evidence requests
- Internal verification notes
- Status updates
- Return/replacement/refund decisions

The ticket workflow represented by the UI includes:

```text
Open
  ↓
Under Review
  ↓
Waiting for Customer / Action Required
  ↓
Evidence / Information Verification
  ↓
Approved / Rejected
  ↓
Resolved
```

## 12.2 Support Admin resolution

Support Admin reviews the ticket and related information/evidence.

For customer complaints such as a defective product:

```text
Customer complaint
      ↓
Support Admin reviews ticket
      ↓
Request proof/evidence if required
      ↓
Verify evidence + policy/item eligibility
      ↓
Resolve directly
      ├── Approve Return
      ├── Approve Replacement
      ├── Approve Refund
      └── Reject under policy
```

The Support Admin communicates with the requester and records the resolution/status in the backend. The frontend must not assume a return, replacement, refund or other resolution is completed until the corresponding backend update is recorded.

## 12.3 Escalation

If the Support Admin cannot resolve the ticket directly, the ticket is escalated to the appropriate responsible role based on the issue:

- **Super Admin** — platform-wide, administrative or policy-level issues requiring super-admin action
- **Operations Manager** — operational, store/zone, fulfilment or broader operational issues requiring operations action
- **Location Manager** — location-specific retailer/location issues requiring local action

The Support Admin remains able to view the ticket status/history and customer conversation after escalation, while the responsible role performs the action required to resolve the issue.

## 12.4 Resolution communication

After a decision or escalation:

- Customer/user is informed of the current support status.
- Required evidence or additional information can be requested.
- The final resolution is recorded against the ticket.
- Ticket activity/history should preserve the support conversation, internal notes and status/decision changes.

# 12. Super Admin Journey

Super Admin dashboard contains:

- Master dashboard
- Operational management
- Vendor management
- Payments & settlements
- Orders
- Support
- Analytics
- Reports

## Master dashboard

Shows aggregated:

- Users
- Vendors
- Orders
- Revenue
- Open tickets
- Pending KYC
- Verification status
- Recent activity
- Vendor performance

## User / Manager management

Admin can:

- View managers
- Add Operations Manager
- Assign city
- Filter by status
- Search
- View manager details

## Vendor management

Admin can:

- View vendors
- Filter by type
- Filter by status
- Search
- Open vendor details
- Review verification information
- Export vendors

## Order management

Admin can:

- Search orders
- Filter order type:
  - Retail
  - Service
  - Fleet
- Filter status
- View order details
- Export data

## Payments / settlements

Admin can:

- Search transactions
- Filter payment status
- Filter settlement status
- Filter date
- View transaction details

## Support

Super Admin can:

- Search tickets
- Filter category
- Filter priority/status
- View ticket details
- Receive tickets escalated by Support Admin
- Resolve issues requiring Super Admin action
- Assign/resolve support issues

## Analytics

Admin can:

- Choose date range
- Compare periods
- View daily/weekly/monthly data
- Export reports
- View user growth
- Vendor growth
- Verification status
- Ticket resolution
- Transaction summary

---

# 13. Cross-service business flows

## Support ticket and escalation

```text
Customer / Retailer / Driver / Other User
  ↓
Create Support Ticket
  ↓
Support Admin
  ↓
Review + communicate + request evidence where required
  ↓
Resolve directly
  ├── Return
  ├── Replacement
  ├── Refund
  └── Reject under policy
  OR
Escalate
  ├── Super Admin
  ├── Operations Manager
  └── Location Manager
  ↓
Responsible role performs required action
  ↓
Support ticket/status updated
  ↓
Requester/customer informed
```

## Retail order

```text
Customer
  ↓
Select delivery location
  ↓
S3: Search products from serviceable nearby retailers
  ↓
S3: Product + retailer + stock + retailer information
  ↓
Customer Cart (S3)
  ↓
Customer changes delivery address?
  ↓
S3/backend: Check serviceability for EACH product/retailer
  ├── Serviceable → keep product
  └── Not serviceable → keep product visible + show
      "This product is not serviceable at this location."
      → Try Another Shop / Remove Product / Change Address
  ↓
Proceed to Checkout
  ↓
Backend: Re-check serviceability + stock before checkout/payment
  ↓
S4: Create Order
  ↓
S3: Validate/Reserve Stock
  ↓
S6: Create/Process Payment
  ↓
S4: Order confirmed
  ↓
Retailer receives order notification
  ↓
Retailer verifies
  ├── Reject → Order: Retailer Rejected
  │            → Customer: "Your order was rejected by the shop."
  │            → Find Another Shop / nearby shops
  └── Accept
       ↓
       Nearby available Fleet Owner / Bike Owner notified
       ↓
       Fleet Owner / Bike Owner verifies + accepts delivery
       ↓
       Delivery Partner reaches retailer
       ↓
       Collects order
       ↓
       Delivers to customer
       ↓
       Order Completed
  ↓
S6: Payment/settlement
  ↓
Customer tracking reflects backend status updates
```

Retail fulfilment tracking follows the responsible-role actions:

```text
Order Placed
  ↓
Waiting for Retailer
  ↓
Retailer Accepted
  ↓
Finding Delivery Partner
  ↓
Delivery Partner Accepted
  ↓
Going to Shop
  ↓
Order Picked Up
  ↓
Out for Delivery
  ↓
Delivered
```

The backend is the source of truth for delivery serviceability and order status. The frontend must not silently remove an unserviceable cart item or advance a fulfilment stage without the corresponding backend update.

If the retailer does not accept or reject within 10 minutes:

```text
Waiting for Retailer
  ↓
10 Minutes
  ↓
No Response
  ↓
Order/Shop Unavailable
```

The customer sees: "The shop did not respond to your order. Please find another shop for this product." The customer can select another nearby shop where the product is available.

## Logistics booking

```text
Customer
  ↓
S4: Select service
  ↓
S4: Route / booking details
  ↓
S5: Available vehicle/driver options
  ↓
S4: Create booking
  ↓
S6: Payment
  ↓
S5: Assignment
  ↓
S4: Trip
  ↓
Driver
  ↓
Pickup
  ↓
Transit
  ↓
Delivery
  ↓
S6: Settlement/payment
  ↓
Customer tracking
```

## Retailer onboarding

```text
Retailer
  ↓
S2: Registration
  ↓
S2: Documents
  ↓
S2: Verification Queue
  ↓
Location/Verification Manager
  ↓
Approve / Reject / Resubmit
  ↓
S2: Retailer status
  ↓
S3: Catalogue operations enabled
```

## Driver onboarding / operational readiness

Current implementation ownership:

```text
Driver
  ↓
S5 Driver record
  ↓
Verification/operational review
  ↓
S5 operational availability
  ↓
Assignment
```

The team should keep the existing S5 Driver implementation for this iteration, while documenting the intended S2/S5 boundary.

---

# 14. Important backend gaps exposed by the UI

These should be tracked rather than silently invented:

1. Location Management UI has LOCATION-related concepts not present in the current 34 entities.
2. Fleet Maintenance UI has no obvious dedicated maintenance entity.
3. Fleet Compliance UI has no dedicated compliance entity.
4. Driver earnings/incentives are visible but no dedicated earnings/incentive entity is in the 34-entity list.
5. Operations Manager messages/conversations do not have dedicated entities in the 34-entity model.
6. Analytics/reporting is largely derived data unless additional persistence is introduced.
7. Customer saved addresses are represented by S3's customer_address entity, but the prototype currently demonstrates browser-local storage in some screens.
8. Some payment methods shown in the UI may be presentation-level options; the real payment implementation must be determined by S6's code.
9. The supplied customer-support UI demonstrates ticket intake, customer communication, evidence verification, return/replacement/refund decisions and support resolution, but the current 34-entity model should be checked before claiming a dedicated support-ticket persistence model or escalation entity.

These are requirements/gaps, not reasons to remove any existing entity.
