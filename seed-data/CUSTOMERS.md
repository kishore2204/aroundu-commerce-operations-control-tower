# Customers (S1 + S3)

> Generated from the seeded database by `seed-data/tools/GenerateSeedDocs.java`; every value below is what the database holds. Long identity ids (products, categories, orders) are the values of a fresh database; UUIDs are random per environment, so records are identified by business key.

Seven customers. **Every customer has exactly two addresses, and the two are always in different zones**; the first (default) address is the one checkout uses unless another is chosen. Between them the addresses cover all four zones (North, South, West, East). Customers 2, 6 and 7 all live in West Bengaluru - three distinct customers in one zone, which is what lets the support-ticket cluster in SUPPORT.md exist.

## Priya Ramanathan

Email: `customer1.chn@lbos.com`  
Password: `Lbos@2026!`  
Phone: 9840055001  
Status: ACTIVE (profile ACTIVE)  
Date of birth: 1992-04-18  
Reward points balance: 36.56

**Address 1** - HOME, default

- address: Flat 4B, Sri Lakshmi Apartments, 22 Paper Mills Road, Perambur
- state: Tamil Nadu
- city: Chennai
- zone: North
- pincode: 600011
- latitude / longitude: 13.1108000, 80.2419000
- default: yes

**Address 2** - WORK, non-default

- address: Third Floor, Tech Park Block C, 80 Feet Road, Rajajinagar
- state: Karnataka
- city: Bengaluru
- zone: West
- pincode: 560010
- latitude / longitude: 12.9915000, 77.5560000
- default: no

The two addresses belong to different zones: **North and West**.

## Rahul Deshpande

Email: `customer2.baw@lbos.com`  
Password: `Lbos@2026!`  
Phone: 9880055002  
Status: ACTIVE (profile ACTIVE)  
Date of birth: 1988-11-02  
Reward points balance: 10.01

**Address 1** - HOME, default

- address: No. 42, 3rd Cross, Basaveshwaranagar, Near Hanumanthappa Circle
- state: Karnataka
- city: Bengaluru
- zone: West
- pincode: 560079
- latitude / longitude: 12.9899000, 77.5385000
- default: yes

**Address 2** - OTHER, non-default

- address: Plot 18, Road No. 3, Vasavi Colony, Habsiguda
- state: Telangana
- city: Hyderabad
- zone: East
- pincode: 500007
- latitude / longitude: 17.4086000, 78.5442000
- default: no

The two addresses belong to different zones: **West and East**.

## Anjali Reddy

Email: `customer3.hye@lbos.com`  
Password: `Lbos@2026!`  
Phone: 9848055003  
Status: ACTIVE (profile ACTIVE)  
Date of birth: 1995-07-23  
Reward points balance: 48.46

**Address 1** - HOME, default

- address: H.No. 6-3-112, Sri Sai Nagar Colony, Uppal
- state: Telangana
- city: Hyderabad
- zone: East
- pincode: 500039
- latitude / longitude: 17.4008000, 78.5603000
- default: yes

**Address 2** - WORK, non-default

- address: Unit 12, Global Info Park, Rajiv Gandhi Salai, Thoraipakkam
- state: Tamil Nadu
- city: Chennai
- zone: South
- pincode: 600097
- latitude / longitude: 12.9432000, 80.2366000
- default: no

The two addresses belong to different zones: **East and South**.

## Vignesh Kannan

Email: `customer4.chn@lbos.com`  
Password: `Lbos@2026!`  
Phone: 9840055004  
Status: ACTIVE (profile ACTIVE)  
Date of birth: 1990-01-30  
Reward points balance: 33.13

**Address 1** - HOME, default

- address: 7/22, Gandhi Street, Kolathur, Near Kolathur Bus Stand
- state: Tamil Nadu
- city: Chennai
- zone: North
- pincode: 600099
- latitude / longitude: 13.1195000, 80.2214000
- default: yes

**Address 2** - OTHER, non-default

- address: Flat 2C, Sea Breeze Residency, Beach Road, Thiruvanmiyur
- state: Tamil Nadu
- city: Chennai
- zone: South
- pincode: 600041
- latitude / longitude: 12.9829000, 80.2593000
- default: no

The two addresses belong to different zones: **North and South**.

## Sneha Raghavan

Email: `customer5.chs@lbos.com`  
Password: `Lbos@2026!`  
Phone: 9840055005  
Status: ACTIVE (profile ACTIVE)  
Date of birth: 1997-09-09  
Reward points balance: 41.79

**Address 1** - HOME, default

- address: 18, Second Main Road, Kasturba Nagar, Adyar
- state: Tamil Nadu
- city: Chennai
- zone: South
- pincode: 600020
- latitude / longitude: 13.0012000, 80.2565000
- default: yes

**Address 2** - WORK, non-default

- address: Plot 44, Survey No. 7, Nacharam Industrial Area, Nacharam
- state: Telangana
- city: Hyderabad
- zone: East
- pincode: 500076
- latitude / longitude: 17.4283000, 78.5561000
- default: no

The two addresses belong to different zones: **South and East**.

## Aditya Hegde

Email: `customer6.baw@lbos.com`  
Password: `Lbos@2026!`  
Phone: 9880055006  
Status: ACTIVE (profile ACTIVE)  
Date of birth: 1985-06-14  
Reward points balance: 25.26

**Address 1** - HOME, default

- address: No. 11, 5th Cross, Vijayanagar Main Road, Vijayanagar
- state: Karnataka
- city: Bengaluru
- zone: West
- pincode: 560040
- latitude / longitude: 12.9719000, 77.5343000
- default: yes

**Address 2** - WORK, non-default

- address: Godown 3, Manali Road, Tondiarpet, Near Tondiarpet Signal
- state: Tamil Nadu
- city: Chennai
- zone: North
- pincode: 600081
- latitude / longitude: 13.1270000, 80.2900000
- default: no

The two addresses belong to different zones: **West and North**.

## Kavya Bhat

Email: `customer7.baw@lbos.com`  
Password: `Lbos@2026!`  
Phone: 9880055007  
Status: ACTIVE (profile ACTIVE)  
Date of birth: 1993-12-05  
Reward points balance: 7.76

**Address 1** - HOME, default

- address: No. 27, 8th Main, Malleshwaram, Near Sampige Road
- state: Karnataka
- city: Bengaluru
- zone: West
- pincode: 560003
- latitude / longitude: 13.0035000, 77.5710000
- default: yes

**Address 2** - OTHER, non-default

- address: Flat 12, Lakshmi Towers, Perambur High Road, Perambur
- state: Tamil Nadu
- city: Chennai
- zone: North
- pincode: 600011
- latitude / longitude: 13.1153000, 80.2388000
- default: no

The two addresses belong to different zones: **West and North**.

