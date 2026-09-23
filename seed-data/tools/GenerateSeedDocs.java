import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Writes the record-level documents of seed-data/ straight from the seeded database, so every table in them is exactly
 * what the database holds. Run it after all six services have started and seeded:
 *
 *   java -cp <jdbc driver jar> seed-data/tools/GenerateSeedDocs.java <jdbc-url> <user> <password> <output dir>
 *
 * (Long identity ids - categories, products, orders - are deterministic on an empty database; UUIDs are random per
 * environment, so the documents identify records by business key and show UUIDs only where they explain a chain.)
 */
public class GenerateSeedDocs {

    static Connection c;
    static Path out;
    static final String PASSWORD = "Lbos@2026!";
    static final ZoneOffset IST = ZoneOffset.ofHoursMinutes(5, 30);
    static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    public static void main(String[] args) throws Exception {
        c = DriverManager.getConnection(args[0], args[1], args.length > 2 ? args[2] : "");
        out = Path.of(args[3]);
        Files.createDirectories(out);
        credentials();
        usersAndManagers();
        retailers();
        fleet();
        customers();
        categoriesAndProducts();
        productsAndTax();
        cartsAndWishlists();
        orders();
        logistics();
        reviews();
        verification();
        finance();
        support();
        notificationsAndAudit();
        System.out.println("documents written to " + out.toAbsolutePath());
    }

    // ================================================================================== helpers

    static List<Map<String, Object>> q(String sql, Object... args) throws SQLException {
        List<Map<String, Object>> rows = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            try (ResultSet rs = ps.executeQuery()) {
                ResultSetMetaData md = rs.getMetaData();
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int i = 1; i <= md.getColumnCount(); i++) row.put(md.getColumnLabel(i).toLowerCase(), rs.getObject(i));
                    rows.add(row);
                }
            }
        }
        return rows;
    }

    static Map<String, Object> one(String sql, Object... args) throws SQLException {
        List<Map<String, Object>> rows = q(sql, args);
        return rows.isEmpty() ? new HashMap<>() : rows.get(0);
    }

    static String s(Object v) {
        if (v == null) return "NULL";
        if (v instanceof Timestamp t) return STAMP.format(t.toInstant().atOffset(IST)) + " IST";
        if (v instanceof OffsetDateTime o) return STAMP.format(o.withOffsetSameInstant(IST)) + " IST";
        if (v instanceof LocalDateTime l) return STAMP.format(l) + " IST";
        if (v instanceof java.sql.Date d) return d.toLocalDate().toString();
        if (v instanceof Time t) return t.toLocalTime().toString().substring(0, 5);
        if (v instanceof Boolean b) return b ? "yes" : "no";
        if (v instanceof BigDecimal b) return b.stripTrailingZeros().scale() < 2 ? b.setScale(2).toPlainString() : b.toPlainString();
        if (v instanceof byte[] b) return b.length + " bytes";
        return String.valueOf(v).replace("|", "\\|").replace("\n", " ");
    }

    /** JSON / text columns: some databases return them as bytes. */
    static String text(Object v) {
        return v instanceof byte[] b ? new String(b, StandardCharsets.UTF_8) : String.valueOf(v);
    }

    static String rs(Object v) {
        return "Rs " + s(v);
    }

    static String table(List<String> headers, List<List<String>> rows) {
        StringBuilder sb = new StringBuilder("| " + String.join(" | ", headers) + " |\n|" + "---|".repeat(headers.size()) + "\n");
        for (List<String> r : rows) sb.append("| ").append(String.join(" | ", r)).append(" |\n");
        return sb.append('\n').toString();
    }

    static List<String> row(Object... cells) {
        List<String> r = new ArrayList<>();
        for (Object cell : cells) r.add(s(cell));
        return r;
    }

    static void write(String file, String content) throws Exception {
        Files.writeString(out.resolve(file), content, StandardCharsets.UTF_8);
    }

    static String name(Object first, Object last) {
        return first + " " + last;
    }

    static final String GENERATED_NOTE = "> Generated from the seeded database by `seed-data/tools/GenerateSeedDocs.java`; every value below is what the "
            + "database holds. Long identity ids (products, categories, orders) are the values of a fresh database; UUIDs are random per environment, so "
            + "records are identified by business key.\n\n";

    // ================================================================================== credentials

    static void credentials() throws Exception {
        List<List<String>> rows = new ArrayList<>();
        String[] roleOrder = {"SUPER_ADMIN", "SUPPORT_STAFF", "OPERATIONS_MANAGER", "LOCATION_MANAGER", "RETAILER", "FLEET_MANAGER", "DRIVER", "CUSTOMER"};
        for (String role : roleOrder) {
            for (Map<String, Object> u : q("select user_account_id, email, first_name, last_name from user_account where role = ? order by email", role)) {
                UUID id = (UUID) u.get("user_account_id");
                String who = name(u.get("first_name"), u.get("last_name"));
                String state = "—", city = "—", zone = "—", service = "S1 (login)", notes = "";
                switch (role) {
                    case "SUPER_ADMIN" -> notes = "Platform-wide access";
                    case "SUPPORT_STAFF" -> notes = "Works the support tickets of all zones";
                    case "OPERATIONS_MANAGER" -> {
                        Map<String, Object> g = one("select c.city_name, s.state_name from operations_manager o join city c on c.city_id = o.city_id join state s on s.state_id = c.state_id where o.user_account_id = ?", id);
                        state = s(g.get("state_name")); city = s(g.get("city_name")); zone = "all zones of " + city; service = "S1 operations_manager";
                    }
                    case "LOCATION_MANAGER" -> {
                        Map<String, Object> g = one("select z.zone_name, c.city_name, s.state_name from location_manager l join zone z on z.zone_id = l.zone_id join city c on c.city_id = z.city_id join state s on s.state_id = c.state_id where l.user_account_id = ?", id);
                        state = s(g.get("state_name")); city = s(g.get("city_name")); zone = s(g.get("zone_name")); service = "S1 location_manager";
                    }
                    case "RETAILER" -> {
                        Map<String, Object> g = one("select r.business_name, z.zone_name, c.city_name, s.state_name from retailer r join zone z on z.zone_id = r.zone_id join city c on c.city_id = r.city_id join state s on s.state_id = c.state_id where r.user_account_id = ?", id);
                        who = s(g.get("business_name")) + " (" + who + ")"; state = s(g.get("state_name")); city = s(g.get("city_name")); zone = s(g.get("zone_name")); service = "S2 retailer";
                    }
                    case "FLEET_MANAGER" -> {
                        Map<String, Object> g = one("select f.business_name, z.zone_name, c.city_name, s.state_name from fleet_owner f join zone z on z.zone_id = f.zone_id join city c on c.city_id = f.city_id join state s on s.state_id = c.state_id where f.user_account_id = ?", id);
                        who = s(g.get("business_name")) + " (" + who + ")"; state = s(g.get("state_name")); city = s(g.get("city_name")); zone = s(g.get("zone_name")); service = "S2 fleet_owner";
                    }
                    case "DRIVER" -> {
                        Map<String, Object> g = one("select f.business_name, z.zone_name, c.city_name, s.state_name from driver d join fleet_owner f on f.fleet_owner_id = d.fleet_owner_id join zone z on z.zone_id = f.zone_id join city c on c.city_id = d.city_id join state s on s.state_id = c.state_id where d.user_account_id = ?", id);
                        notes = "Driver of " + g.get("business_name"); state = s(g.get("state_name")); city = s(g.get("city_name")); zone = s(g.get("zone_name")); service = "S5 driver";
                    }
                    case "CUSTOMER" -> {
                        List<Map<String, Object>> a = q("select z.zone_name, c.city_name, s.state_name, a.is_default from customer_profile p join customer_address a on a.customer_profile_id = p.customer_profile_id join zone z on z.zone_id = a.zone_id join city c on c.city_id = a.city_id join state s on s.state_id = c.state_id where p.user_account_id = ? order by a.is_default desc", id);
                        state = s(a.get(0).get("state_name")); city = s(a.get(0).get("city_name")); zone = s(a.get(0).get("zone_name")); service = "S3 customer_profile";
                        notes = "Default address " + zone + "; second address in " + a.get(1).get("zone_name") + " (" + a.get(1).get("city_name") + ")";
                    }
                    default -> { }
                }
                rows.add(row(role, who, "`" + u.get("email") + "`", "`" + PASSWORD + "`", state, city, zone, service, notes));
            }
        }
        write("credentials.md", "# Credentials\n\n" + GENERATED_NOTE
                + "**Every account has the same development password: `" + PASSWORD + "`** (it satisfies the application's password policy: 8-72 characters "
                + "with an uppercase letter, a lowercase letter, a number and a special character). The database stores only its BCrypt hash "
                + "(`{bcrypt}$2a$10$...`, produced by the application's own delegating `PasswordEncoder`); the plaintext exists only in this document.\n\n"
                + "Log in with `POST /api/v1/auth/login` `{\"email\": \"...\", \"password\": \"" + PASSWORD + "\"}` (through the gateway, `http://localhost:8080`). "
                + "Every account is `ACTIVE`; the roles that depend on a profile can log in because their profile is verified / active "
                + "(retailers `VERIFIED`, fleet owners `VERIFIED` + `ACTIVE`, drivers `ACTIVE`, managers with an `ACTIVE` assignment).\n\n"
                + "Zone names are exactly `North`, `South`, `East` and `West`.\n\n"
                + table(List.of("Role", "Business / Name", "Email", "Password", "State", "City", "Zone", "Service", "Notes"), rows));
    }

    // ================================================================================== users and managers

    static void usersAndManagers() throws Exception {
        StringBuilder sb = new StringBuilder("# Users, Managers and Territory (S1)\n\n" + GENERATED_NOTE);
        sb.append("## Territory\n\nThree states, three cities and **exactly four zones** - North, South, West and East.\n\n");
        List<List<String>> t = new ArrayList<>();
        for (Map<String, Object> r : q("select s.state_name, s.country_code, c.city_name, z.zone_name, z.is_active from zone z join city c on c.city_id = z.city_id join state s on s.state_id = c.state_id order by z.zone_name desc, c.city_name")) {
            t.add(row(r.get("state_name"), r.get("country_code"), r.get("city_name"), r.get("zone_name"), r.get("is_active")));
        }
        sb.append(table(List.of("State", "Country", "City", "Zone", "Active"), t));
        sb.append("| Zone | City / State | Who works there |\n|---|---|---|\n");
        sb.append("| North | Chennai / Tamil Nadu | lm1.chn, Chennai Fresh Basket, Perambur Daily Needs, Chennai City Carriers |\n");
        sb.append("| South | Chennai / Tamil Nadu | lm2.chn, Southern Spice Market |\n");
        sb.append("| West | Bengaluru / Karnataka | lm1.baw, Bengaluru Daily Mart, Bengaluru Route Logistics |\n");
        sb.append("| East | Hyderabad / Telangana | lm1.hye, Hyderabad Harvest Store, Deccan Fleet Services |\n\n");

        sb.append("## User accounts (`user_account`, " + one("select count(*) n from user_account").get("n") + ")\n\n");
        List<List<String>> u = new ArrayList<>();
        for (Map<String, Object> r : q("select email, first_name, last_name, phone_number, role, account_status, password_changed_on, last_login_at, terms_accepted_at, created_at from user_account order by role, email")) {
            u.add(row(r.get("role"), name(r.get("first_name"), r.get("last_name")), r.get("email"), r.get("phone_number"), r.get("account_status"),
                    r.get("created_at"), r.get("password_changed_on"), r.get("last_login_at"), r.get("terms_accepted_at")));
        }
        sb.append(table(List.of("Role", "Name", "Email", "Phone", "Status", "Created", "Password changed", "Last login", "Terms accepted"), u));
        sb.append("Self-registered roles (customers, retailers, fleet owners) accepted the Terms & Conditions two minutes after creating the account; "
                + "accounts created by an administrator, an Operations Manager or a fleet owner (staff, managers, drivers) carry no terms date. "
                + "Phone numbers are exactly 10 digits and unique.\n\n");

        sb.append("## Operations Managers (`operations_manager`)\n\n");
        List<List<String>> om = new ArrayList<>();
        for (Map<String, Object> r : q("select u.email, u.first_name, u.last_name, c.city_name, s.state_name, o.assignment_status, o.assigned_at, o.updated_at, o.version from operations_manager o join user_account u on u.user_account_id = o.user_account_id join city c on c.city_id = o.city_id join state s on s.state_id = c.state_id order by c.city_name")) {
            om.add(row(name(r.get("first_name"), r.get("last_name")), r.get("email"), r.get("city_name"), r.get("state_name"), r.get("assignment_status"), r.get("assigned_at"), r.get("updated_at"), r.get("version")));
        }
        sb.append(table(List.of("Name", "Email", "City", "State", "Assignment", "Assigned at", "Updated at", "Version"), om));

        sb.append("## Location Managers (`location_manager`)\n\n");
        List<List<String>> lm = new ArrayList<>();
        for (Map<String, Object> r : q("select u.email, u.first_name, u.last_name, z.zone_name, c.city_name, ou.email as om_email, l.assignment_status, l.assigned_at from location_manager l join user_account u on u.user_account_id = l.user_account_id join zone z on z.zone_id = l.zone_id join city c on c.city_id = z.city_id join operations_manager o on o.operations_manager_id = l.operations_manager_id join user_account ou on ou.user_account_id = o.user_account_id order by c.city_name, z.zone_name")) {
            lm.add(row(name(r.get("first_name"), r.get("last_name")), r.get("email"), r.get("zone_name"), r.get("city_name"), r.get("om_email"), r.get("assignment_status"), r.get("assigned_at")));
        }
        sb.append(table(List.of("Name", "Email", "Zone", "City", "Supervising Operations Manager", "Assignment", "Assigned at"), lm));

        sb.append("## Location Manager transfer history (`location_manager_assignment_history`)\n\n");
        List<List<String>> h = new ArrayList<>();
        for (Map<String, Object> r : q("select u.email, h.from_zone_name, h.from_city_name, h.from_assigned_at, h.to_zone_name, h.to_city_name, h.changed_at from location_manager_assignment_history h join location_manager l on l.location_manager_id = h.location_manager_id join user_account u on u.user_account_id = l.user_account_id")) {
            h.add(row(r.get("email"), r.get("from_zone_name") + " / " + r.get("from_city_name"), r.get("from_assigned_at"), r.get("to_zone_name") + " / " + r.get("to_city_name"), r.get("changed_at")));
        }
        sb.append(table(List.of("Location Manager", "From", "From assigned at", "To", "Moved at"), h));
        sb.append("`lm2.chn` started as the North officer and moved to South when `lm1.chn` was hired for North, which is the row `PUT /api/v1/location-managers/{id}/transfer` leaves behind.\n\n");
        sb.append("`password_reset_token` is intentionally not seeded: a token is a short-lived (30 minute) secret created by the forgot-password flow, so a seeded one would only be an expired row.\n");
        write("USERS_AND_MANAGERS.md", sb.toString());
    }

    // ================================================================================== retailers

    static void retailers() throws Exception {
        StringBuilder sb = new StringBuilder("# Retailers (S2)\n\n" + GENERATED_NOTE
                + "Five retailers, all `VERIFIED`: the three requested ones plus one in Chennai South (so a South customer can shop) and a second one in Chennai North "
                + "(so a North customer can place a **multi-retailer** checkout). Each has an APPROVED verification queue reviewed by the Location Manager of its zone, with the four documents a retailer needs "
                + "(`GST_CERTIFICATE`, `PAN_CARD`, `BUSINESS_LICENSE`, `ADDRESS_PROOF`).\n\n");
        for (Map<String, Object> r : q("select r.retailer_id, r.business_name, u.email, u.first_name, u.last_name, u.phone_number, r.registration_number, r.gst_number, r.retailer_status, r.is_open, r.opens_at, r.closes_at, r.latitude, r.longitude, z.zone_name, c.city_name, s.state_name, ou.email as om_email from retailer r join user_account u on u.user_account_id = r.user_account_id join zone z on z.zone_id = r.zone_id join city c on c.city_id = r.city_id join state s on s.state_id = c.state_id left join operations_manager o on o.operations_manager_id = r.operations_manager_id left join user_account ou on ou.user_account_id = o.user_account_id order by r.business_name")) {
            sb.append("## ").append(r.get("business_name")).append("\n\n");
            sb.append(table(List.of("Field", "Value"), List.of(
                    row("Login email", "`" + r.get("email") + "`"), row("Password", "`" + PASSWORD + "`"),
                    row("Owner", name(r.get("first_name"), r.get("last_name"))), row("Phone", r.get("phone_number")),
                    row("State / City / Zone", r.get("state_name") + " / " + r.get("city_name") + " / " + r.get("zone_name")),
                    row("Supervising Operations Manager", r.get("om_email")), row("Registration number", r.get("registration_number")),
                    row("GSTIN", r.get("gst_number")), row("Retailer status", r.get("retailer_status")), row("Shop open", r.get("is_open")),
                    row("Opening hours", s(r.get("opens_at")) + " - " + s(r.get("closes_at"))), row("Location (lat, long)", r.get("latitude") + ", " + r.get("longitude")))));
            sb.append("**Verification** ");
            Map<String, Object> qrow = one("select verification_queue_id, verification_status, created_at, updated_at, is_active, reviewed_by_account_id, zone_id from verification_queue where subject_type = 'RETAILER' and subject_id = ?", r.get("retailer_id"));
            sb.append("queue `").append(qrow.get("verification_status")).append("`, submitted ").append(s(qrow.get("created_at"))).append(", decided ").append(s(qrow.get("updated_at"))).append(".\n\n");
            List<List<String>> docs = new ArrayList<>();
            for (Map<String, Object> d : q("select document_type_name, version_number, is_current_version, document_status, file_name, file_size_bytes, expiry_date, reject_reason, reviewer_comment from verification_document where verification_queue_id = ? order by document_type_name, version_number", qrow.get("verification_queue_id"))) {
                docs.add(row(d.get("document_type_name"), d.get("version_number"), d.get("is_current_version"), d.get("document_status"), d.get("file_name"), d.get("file_size_bytes"), d.get("expiry_date"), d.get("reject_reason") == null ? d.get("reviewer_comment") : "Rejected: " + d.get("reject_reason")));
            }
            sb.append(table(List.of("Document", "Version", "Current", "Status", "File", "Bytes", "Expiry", "Reviewer comment"), docs));
            Map<String, Object> stats = one("select count(*) as products from products where retailer_id = ?", r.get("retailer_id"));
            Map<String, Object> ord = one("select count(distinct order_id) as orders from order_item where retailer_id = ?", r.get("retailer_id"));
            sb.append("Products: ").append(stats.get("products")).append(" - orders received: ").append(ord.get("orders")).append(" (see PRODUCTS.md and ORDERS.md).\n\n");
        }
        write("RETAILERS.md", sb.toString());
    }

    // ================================================================================== fleet

    static void fleet() throws Exception {
        StringBuilder sb = new StringBuilder("# Fleet Owners, Drivers, Vehicles (S2 + S5)\n\n" + GENERATED_NOTE
                + "Three fleet owners, **three drivers and four vehicles each**: two mini trucks and a light truck (four-wheelers) and **one bike (two-wheeler)**. "
                + "Two drivers hold an ACTIVE assignment on a mini truck, the third driver on the bike; the light truck is free and the third driver's earlier assignment on it is kept as an ENDED row. "
                + "Vehicle numbers follow the Indian format (state code, RTO number, series, four digits); driving licences are `<state><RTO><year><7 digits>`.\n\n");
        for (Map<String, Object> f : q("select f.fleet_owner_id, f.business_name, u.email, u.first_name, u.last_name, u.phone_number, f.profile_status, f.owner_status, z.zone_name, c.city_name, s.state_name, ou.email as om_email, bv.email as bank_email from fleet_owner f join user_account u on u.user_account_id = f.user_account_id join zone z on z.zone_id = f.zone_id join city c on c.city_id = f.city_id join state s on s.state_id = c.state_id left join operations_manager o on o.operations_manager_id = f.operations_manager_id left join user_account ou on ou.user_account_id = o.user_account_id left join user_account bv on bv.user_account_id = f.bank_verified_by_account_id order by f.business_name")) {
            UUID fid = (UUID) f.get("fleet_owner_id");
            sb.append("# ").append(f.get("business_name")).append("\n\n");
            sb.append("Email:\n`").append(f.get("email")).append("`\n\nPassword:\n`").append(PASSWORD).append("`\n\nState:\n").append(f.get("state_name")).append("\n\nCity:\n").append(f.get("city_name")).append("\n\nZone:\n").append(f.get("zone_name")).append("\n\n");
            sb.append(table(List.of("Field", "Value"), List.of(row("Owner", name(f.get("first_name"), f.get("last_name"))), row("Phone", f.get("phone_number")),
                    row("Profile status", f.get("profile_status")), row("Owner status", f.get("owner_status")), row("Supervising Operations Manager", f.get("om_email")),
                    row("Bank details verified by", f.get("bank_email")))));
            sb.append("## Drivers\n\n");
            List<List<String>> d = new ArrayList<>();
            for (Map<String, Object> r : q("select u.first_name, u.last_name, u.email, u.phone_number, d.license_number, d.license_expiry_date, d.driver_status, d.commission_percent, d.latitude, d.longitude, vu.email as verifier, v.registration_number from driver d join user_account u on u.user_account_id = d.user_account_id left join user_account vu on vu.user_account_id = d.verified_by_account_id left join vehicle_assignment a on a.driver_id = d.driver_id and a.assignment_status = 'ACTIVE' left join vehicle v on v.vehicle_id = a.vehicle_id where d.fleet_owner_id = ? order by u.email", fid)) {
                d.add(row(name(r.get("first_name"), r.get("last_name")), "`" + r.get("email") + "`", "`" + PASSWORD + "`", r.get("phone_number"), r.get("license_number"), r.get("license_expiry_date"), r.get("driver_status"), r.get("commission_percent") + "%", r.get("latitude") + ", " + r.get("longitude"), r.get("verifier"), r.get("registration_number")));
            }
            sb.append(table(List.of("Driver Name", "Email", "Password", "Phone", "Licence no.", "Licence expiry", "Status", "Commission", "Position (lat, long)", "Verified by", "Active vehicle"), d));
            sb.append("## Vehicles\n\n");
            List<List<String>> v = new ArrayList<>();
            for (Map<String, Object> r : q("select v.make, v.model, v.registration_number, v.vehicle_type, v.capacity_kg, v.model_year, v.vehicle_status, v.latitude, v.longitude, uu.email as updated_by from vehicle v left join user_account uu on uu.user_account_id = v.updated_by_account_id where v.fleet_owner_id = ? order by v.registration_number", fid)) {
                v.add(row(r.get("make"), r.get("model"), r.get("registration_number"), r.get("vehicle_type") + ("BIKE".equals(r.get("vehicle_type")) ? " (two-wheeler)" : " (four-wheeler)"), r.get("capacity_kg") + " kg", r.get("model_year"), r.get("vehicle_status"), r.get("latitude") + ", " + r.get("longitude"), r.get("updated_by")));
            }
            sb.append(table(List.of("Brand", "Model", "Vehicle No.", "Vehicle Type", "Capacity", "Model year", "Status", "Position (lat, long)", "Updated by"), v));
            sb.append("## Driver - vehicle assignments\n\n");
            List<List<String>> a = new ArrayList<>();
            for (Map<String, Object> r : q("select u.email, v.registration_number, v.vehicle_type, a.assignment_status, a.assigned_at, a.ended_at, a.cargo_weight_kg, a.required_vehicle_type, au.email as by_email from vehicle_assignment a join driver d on d.driver_id = a.driver_id join user_account u on u.user_account_id = d.user_account_id join vehicle v on v.vehicle_id = a.vehicle_id left join user_account au on au.user_account_id = a.assigned_by_account_id where d.fleet_owner_id = ? order by a.assigned_at", fid)) {
                a.add(row(r.get("email"), r.get("registration_number") + " (" + r.get("vehicle_type") + ")", r.get("assignment_status"), r.get("assigned_at"), r.get("ended_at"), r.get("cargo_weight_kg") + " kg", r.get("required_vehicle_type"), r.get("by_email")));
            }
            sb.append(table(List.of("Driver", "Vehicle", "Status", "Assigned at", "Ended at", "Cargo", "Required type", "Assigned by"), a));
            sb.append("## Fleet expenses\n\n");
            List<List<String>> e = new ArrayList<>();
            for (Map<String, Object> r : q("select e.expense_type, e.amount, e.expense_date, e.approval_status, v.registration_number, du.email as driver_email, cu.email as created_by, au.email as approved_by, e.proof_file_name, e.proof_content_type from fleet_expense e join vehicle v on v.vehicle_id = e.vehicle_id left join driver d on d.driver_id = e.driver_id left join user_account du on du.user_account_id = d.user_account_id left join user_account cu on cu.user_account_id = e.created_by_account_id left join user_account au on au.user_account_id = e.approved_by_account_id where e.fleet_owner_id = ? order by e.expense_date", fid)) {
                e.add(row(r.get("expense_type"), rs(r.get("amount")), r.get("expense_date"), r.get("approval_status"), r.get("registration_number"), r.get("driver_email"), r.get("created_by"), r.get("approved_by"), r.get("proof_file_name")));
            }
            sb.append(table(List.of("Type", "Amount", "Date", "Status", "Vehicle", "Driver", "Created by", "Approved by", "Proof file"), e));
        }
        write("FLEET.md", sb.toString());
    }

    // ================================================================================== customers

    static void customers() throws Exception {
        StringBuilder sb = new StringBuilder("# Customers (S1 + S3)\n\n" + GENERATED_NOTE
                + "Seven customers. **Every customer has exactly two addresses, and the two are always in different zones**; the first (default) address is the one checkout uses unless another is chosen. "
                + "Between them the addresses cover all four zones (North, South, West, East). Customers 2, 6 and 7 all live in West Bengaluru - three distinct customers in one zone, which is what lets the support-ticket cluster in SUPPORT.md exist.\n\n");
        for (Map<String, Object> cu : q("select p.customer_profile_id, u.email, u.first_name, u.last_name, u.phone_number, u.account_status, p.date_of_birth, p.profile_status, p.reward_points_balance from customer_profile p join user_account u on u.user_account_id = p.user_account_id order by u.email")) {
            UUID pid = (UUID) cu.get("customer_profile_id");
            sb.append("## ").append(name(cu.get("first_name"), cu.get("last_name"))).append("\n\n");
            sb.append("Email: `").append(cu.get("email")).append("`  \nPassword: `").append(PASSWORD).append("`  \nPhone: ").append(cu.get("phone_number")).append("  \nStatus: ")
                    .append(cu.get("account_status")).append(" (profile ").append(cu.get("profile_status")).append(")  \nDate of birth: ").append(s(cu.get("date_of_birth")))
                    .append("  \nReward points balance: ").append(s(cu.get("reward_points_balance"))).append("\n\n");
            int n = 1;
            List<String> zones = new ArrayList<>();
            for (Map<String, Object> a : q("select a.address_tag, a.address_line_1, a.address_line_2, a.postal_code, a.latitude, a.longitude, a.is_default, z.zone_name, c.city_name, s.state_name from customer_address a join zone z on z.zone_id = a.zone_id join city c on c.city_id = a.city_id join state s on s.state_id = c.state_id where a.customer_profile_id = ? order by a.is_default desc, a.address_tag", pid)) {
                zones.add(s(a.get("zone_name")));
                sb.append("**Address ").append(n++).append("** - ").append(a.get("address_tag")).append(", ").append(Boolean.TRUE.equals(a.get("is_default")) ? "default" : "non-default").append("\n\n");
                sb.append("- address: ").append(a.get("address_line_1")).append(", ").append(a.get("address_line_2")).append("\n- state: ").append(a.get("state_name")).append("\n- city: ").append(a.get("city_name"))
                        .append("\n- zone: ").append(a.get("zone_name")).append("\n- pincode: ").append(a.get("postal_code")).append("\n- latitude / longitude: ").append(a.get("latitude")).append(", ").append(a.get("longitude"))
                        .append("\n- default: ").append(Boolean.TRUE.equals(a.get("is_default")) ? "yes" : "no").append("\n\n");
            }
            sb.append("The two addresses belong to different zones: **").append(String.join(" and ", zones)).append("**.\n\n");
        }
        write("CUSTOMERS.md", sb.toString());
    }

    // ================================================================================== categories / products

    static void categoriesAndProducts() throws Exception {
        StringBuilder cat = new StringBuilder("# Product Categories (S3)\n\n" + GENERATED_NOTE + "Categories are `product_categories` rows with a `Long` identity id. Eight are ACTIVE (each has products and a tax rule per state); "
                + "\"Festive Gifting\" is INACTIVE - it cannot be given to a product or a tax rule and shows how the active-only rule of INC0010084 behaves.\n\n");
        List<List<String>> rows = new ArrayList<>();
        for (Map<String, Object> r : q("select c.category_id, c.category_name, c.description, c.status, count(p.product_id) as products from product_categories c left join products p on p.category_id = c.category_id group by c.category_id, c.category_name, c.description, c.status order by c.category_id")) {
            rows.add(row(r.get("category_id"), r.get("category_name"), r.get("description"), r.get("status"), r.get("products")));
        }
        cat.append(table(List.of("Category id", "Name", "Description", "Status", "Products"), rows));
        write("CATEGORIES.md", cat.toString());

        StringBuilder sb = new StringBuilder("# Products (S3)\n\n" + GENERATED_NOTE + "Thirty products, six per retailer, every one in a real category. `Stock now` is the opening stock less what the seeded, non-cancelled orders "
                + "ordered (S4 deducts stock exactly as `InventoryClient.deductStock` does); the low-stock threshold and weight are the values the retailer would enter in the catalogue. "
                + "One product (`HHE-FLOORCLEAN-1L`) is a DRAFT: not yet on sale. `PKG-BISCUIT-6PK` carries the `TRENDING` quality flag because it has five reviews averaging 4.8 (ReviewServiceImpl rule).\n\n");
        for (Map<String, Object> r : q("select distinct r.business_name, r.retailer_id from retailer r order by r.business_name")) {
            sb.append("## ").append(r.get("business_name")).append("\n\n");
            List<List<String>> p = new ArrayList<>();
            for (Map<String, Object> x : q("select p.product_id, p.sku, p.product_name, c.category_name, p.description, p.unit_price, p.stock_quantity, p.low_stock_threshold, p.weight_kg, p.status, p.quality_flag, p.created_at, p.updated_at, (select coalesce(sum(i.quantity), 0) from order_item i join orders o on o.order_id = i.order_id where i.product_id = p.product_id and o.order_status <> 'CANCELLED') as sold from products p join product_categories c on c.category_id = p.category_id where p.retailer_id = ? order by p.product_id", r.get("retailer_id"))) {
                long sold = ((Number) x.get("sold")).longValue();
                p.add(row(x.get("product_id"), x.get("sku"), x.get("product_name"), x.get("category_name"), x.get("description"), rs(x.get("unit_price")),
                        ((Number) x.get("stock_quantity")).longValue() + sold, x.get("stock_quantity"), x.get("low_stock_threshold"), x.get("weight_kg") + " kg", x.get("status"), x.get("quality_flag"), x.get("created_at")));
            }
            sb.append(table(List.of("Id", "SKU", "Product", "Category", "Description", "Unit price", "Opening stock", "Stock now", "Low-stock threshold", "Weight", "Status", "Quality flag", "Listed"), p));
        }
        write("PRODUCTS.md", sb.toString());
    }

    // ================================================================================== tax

    static void productsAndTax() throws Exception {
        StringBuilder sb = new StringBuilder("# Products and Tax (S3 + S6)\n\n" + GENERATED_NOTE);
        sb.append("## How tax is linked in the current project\n\n```text\nRetailer\n   ↓ owns\nProduct (S3 products.category_id)\n   ↓ belongs to\nProduct Category (S3 product_categories)\n   ↓ referenced BY ID from S6 (no foreign key, no copy of the category table)\nTaxConfiguration (S6 tax_configuration.product_category_id)\n   ↓ one active rule per category and state\nState (S1 state)  ←  the state of the customer's delivery city\n   ↓\nCGST % + SGST %  (effective from / to, active)\n```\n\n");
        sb.append("At checkout S3 sends S6 one tax item per cart line - `productId`, `productCategoryId`, `quantity`, `unitPrice` - per retailer; S6 resolves the delivery city's state (from S1), loads the active rules of the "
                + "basket's categories in that state in one query, taxes **each line with its own category's rate** (`quantity x price x (CGST + SGST) / 100`, rounded per line to 2 decimals) and rejects the basket if a category "
                + "has no applicable rule - there is no default rate (`TaxCalculationService`). The order stores the tax it was charged, so later rate changes never touch it.\n\n");
        sb.append("## Tax configuration (`tax_configuration`)\n\n");
        List<List<String>> t = new ArrayList<>();
        for (Map<String, Object> r : q("select c.category_id, c.category_name, s.state_name, t.cgst, t.sgst, t.effective_from, t.effective_to, t.active, t.tax_category_name from tax_configuration t join product_categories c on c.category_id = t.product_category_id join state s on s.state_id = t.state_id order by c.category_id, s.state_name, t.effective_from")) {
            t.add(row(r.get("category_id"), r.get("category_name"), r.get("state_name"), r.get("cgst") + "%", r.get("sgst") + "%", ((BigDecimal) r.get("cgst")).add((BigDecimal) r.get("sgst")) + "%", r.get("effective_from"), r.get("effective_to"), r.get("active")));
        }
        sb.append(table(List.of("Category id", "Category", "State", "CGST", "SGST", "Total GST", "Effective from", "Effective to", "Active"), t));
        sb.append("Every ACTIVE category has one ACTIVE rule in each of the three states (24 active rules); the closed, inactive Tamil Nadu Beverages row (9% + 9% until 2024-03-31) is history and never applies. "
                + "`Festive Gifting` (INACTIVE) has no rule. `taxCategoryName` holds the category's name as the display snapshot.\n\n");

        sb.append("## Product -> category -> tax\n\n");
        List<List<String>> p = new ArrayList<>();
        for (Map<String, Object> r : q("select r.business_name, p.sku, p.product_name, c.category_name, (select t.cgst + t.sgst from tax_configuration t join state s on s.state_id = t.state_id where t.product_category_id = c.category_id and s.state_name = 'Tamil Nadu' and t.active = true) as tn, (select t.cgst + t.sgst from tax_configuration t join state s on s.state_id = t.state_id where t.product_category_id = c.category_id and s.state_name = 'Karnataka' and t.active = true) as ka, (select t.cgst + t.sgst from tax_configuration t join state s on s.state_id = t.state_id where t.product_category_id = c.category_id and s.state_name = 'Telangana' and t.active = true) as ts from products p join product_categories c on c.category_id = p.category_id join retailer r on r.retailer_id = p.retailer_id order by r.business_name, p.product_id")) {
            p.add(row(r.get("business_name"), r.get("sku"), r.get("product_name"), r.get("category_name"), r.get("tn") + "%", r.get("ka") + "%", r.get("ts") + "%"));
        }
        sb.append(table(List.of("Retailer", "SKU", "Product", "Category", "Tamil Nadu", "Karnataka", "Telangana"), p));

        sb.append("## Tax charged on the seeded orders\n\nFor every order the state is the state of the delivery address' city; each line uses the active rule of the product's category in that state.\n\n");
        List<List<String>> o = new ArrayList<>();
        for (Map<String, Object> r : q("select o.order_id, o.order_number, o.order_type, o.tax_amount, o.delivery_address from orders o where o.order_type = 'RETAIL' order by o.order_id")) {
            long oid = ((Number) r.get("order_id")).longValue();
            List<String> lines = new ArrayList<>();
            String state = "";
            for (Map<String, Object> l : q("select i.sku_snapshot, i.quantity, i.unit_price, c.category_name, t.cgst + t.sgst as rate, s.state_name from order_item i join products p on p.product_id = i.product_id join product_categories c on c.category_id = p.category_id join orders o on o.order_id = i.order_id join customer_address a on a.customer_profile_id = o.customer_profile_id and o.delivery_address like a.address_line_1 || '%' join city ci on ci.city_id = a.city_id join state s on s.state_id = ci.state_id join tax_configuration t on t.product_category_id = c.category_id and t.state_id = s.state_id and t.active = true where i.order_id = ? order by i.order_item_id", oid)) {
                state = s(l.get("state_name"));
                BigDecimal tax = ((BigDecimal) l.get("unit_price")).multiply(BigDecimal.valueOf(((Number) l.get("quantity")).longValue())).multiply((BigDecimal) l.get("rate")).divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
                lines.add(l.get("sku_snapshot") + " (" + l.get("category_name") + " " + l.get("rate") + "%) = " + tax);
            }
            o.add(row(r.get("order_number"), state, String.join("; ", lines), r.get("tax_amount")));
        }
        sb.append(table(List.of("Order", "Delivery state", "Lines: SKU (category rate) = tax", "Order tax"), o));
        write("PRODUCTS_AND_TAX.md", sb.toString());
    }

    // ================================================================================== carts / wishlists

    static void cartsAndWishlists() throws Exception {
        StringBuilder sb = new StringBuilder("# Carts and Wishlists (S3)\n\n" + GENERATED_NOTE
                + "A cart line is a `customer_cart` row (customer + product, unique per pair) with its `customer_cart_item` (retailer, quantity, status, note). Customers 1 and 4 hold **multi-retailer carts** "
                + "(two Chennai North shops: checkout will split them into one order per retailer, exactly like the seeded orders O6/O7 and O15/O16); customers 2, 3 and 5 hold single-retailer carts; customers 6 and 7 have no cart.\n\n## Carts\n\n");
        List<List<String>> rows = new ArrayList<>();
        for (Map<String, Object> r : q("select u.email, r.business_name, p.sku, p.product_name, i.quantity, p.unit_price, i.status, i.description, c.added_at from customer_cart c join customer_profile cp on cp.customer_profile_id = c.customer_profile_id join user_account u on u.user_account_id = cp.user_account_id join products p on p.product_id = c.product_id join customer_cart_item i on i.cart_id = c.cart_id join retailer r on r.retailer_id = i.retailer_id order by u.email, r.business_name, p.sku")) {
            rows.add(row(r.get("email"), r.get("business_name"), r.get("sku"), r.get("product_name"), r.get("quantity"), rs(r.get("unit_price")), rs(((BigDecimal) r.get("unit_price")).multiply(BigDecimal.valueOf(((Number) r.get("quantity")).longValue()))), r.get("status"), r.get("description"), r.get("added_at")));
        }
        sb.append(table(List.of("Customer", "Retailer", "SKU", "Product", "Qty", "Unit price", "Line total", "Status", "Note", "Added"), rows));
        sb.append("## Wishlists\n\nSeveral wishlist entries belong to a retailer outside the customer's default zone (for example customer 1, whose default zone is North, has a West and an East product), so the zone rule for moving a wishlist product into the cart can be exercised.\n\n");
        List<List<String>> w = new ArrayList<>();
        for (Map<String, Object> r : q("select u.email, r.business_name, z.zone_name, p.sku, p.product_name, w.created_at from customer_wishlist_item w join customer_profile cp on cp.customer_profile_id = w.customer_profile_id join user_account u on u.user_account_id = cp.user_account_id join products p on p.product_id = w.product_id join retailer r on r.retailer_id = p.retailer_id join zone z on z.zone_id = r.zone_id order by u.email, w.created_at")) {
            w.add(row(r.get("email"), r.get("business_name"), r.get("zone_name"), r.get("sku"), r.get("product_name"), r.get("created_at")));
        }
        sb.append(table(List.of("Customer", "Retailer", "Retailer's zone", "SKU", "Product", "Added"), w));
        write("CARTS_AND_WISHLISTS.md", sb.toString());
    }

    // ================================================================================== orders

    static void orders() throws Exception {
        StringBuilder sb = new StringBuilder("# Orders (S4)\n\n" + GENERATED_NOTE);
        sb.append("## How the orders were produced\n\nCheckout creates **one RETAIL order per retailer** (`CheckoutServiceImpl` splits the cart by retailer; the order number is `ORD-<epoch ms>-<n>`); the orders of one checkout share "
                + "the customer and the placement moment. The two multi-retailer checkouts are therefore *two orders each*:\n\n```text\nCustomer 1's cart (Chennai Fresh Basket + Perambur Daily Needs)  ->  checkout  ->  O6 (Chennai Fresh Basket) + O7 (Perambur Daily Needs)\nCustomer 4's cart (Chennai Fresh Basket + Perambur Daily Needs)  ->  checkout  ->  O15 (Chennai Fresh Basket) + O16 (Perambur Daily Needs)\n```\n\n"
                + "Money follows the checkout formulas: line total = quantity x unit price; tax per line from S6's tax rule of the category in the delivery state; delivery charge Rs 49.00 per retailer order; platform fee 2% of the subtotal; "
                + "reward-point discount off the total (only O14 redeems points: Rs 40.00); `total = subtotal + tax + delivery + platform fee - discount`. Status follows the OrderService / TripService state machines. "
                + "The keys O1-O21 (retail) and L1-L2 (logistics bookings) are the keys of the seed plan and are used throughout these documents. `statusHistoryJson` lists the transitions (the application itself leaves `[]`; the seed fills it so the timeline is visible), `orderTrackingJson` is `{}` as the application writes it.\n\n");
        List<Map<String, Object>> orders = q("select o.order_id, o.order_number, o.order_type, o.order_date, o.subtotal_amount, o.delivery_charge, o.discount_amount, o.tax_amount, o.platform_fee_amount, o.total_amount, o.order_status, o.payment_method, o.payment_status, o.transaction_reference, o.delivery_address, o.delivery_latitude, o.delivery_longitude, o.cancellation_reason, o.cancelled_datetime, o.cancellation_fee_amount, o.updated_datetime, o.status_history_json, u.email as customer_email, u.first_name, u.last_name, cp.customer_profile_id from orders o join customer_profile cp on cp.customer_profile_id = o.customer_profile_id join user_account u on u.user_account_id = cp.user_account_id order by o.order_id");
        sb.append("## Overview\n\n");
        List<List<String>> ov = new ArrayList<>();
        int retailNo = 0, bookingNo = 0;
        Map<Long, String> label = new HashMap<>();
        for (Map<String, Object> o : orders) {
            long id = ((Number) o.get("order_id")).longValue();
            label.put(id, "RETAIL".equals(o.get("order_type")) ? "O" + (++retailNo) : "L" + (++bookingNo));
        }
        for (Map<String, Object> o : orders) {
            long id = ((Number) o.get("order_id")).longValue();
            String zone = one("select z.zone_name from customer_address a join zone z on z.zone_id = a.zone_id where a.customer_profile_id = ? and ? like a.address_line_1 || '%'", o.get("customer_profile_id"), o.get("delivery_address")).getOrDefault("zone_name", "—").toString();
            String retailer = "RETAIL".equals(o.get("order_type")) ? one("select r.business_name from order_item i join retailer r on r.retailer_id = i.retailer_id where i.order_id = ? limit 1", id).get("business_name").toString() : "—";
            String trip = one("select t.trip_number, t.trip_status from trip t where t.order_id = ?", id).isEmpty() ? "—" : one("select t.trip_number from trip t where t.order_id = ?", id).get("trip_number").toString();
            ov.add(row("**" + label.get(id) + "** #" + id, o.get("order_number"), o.get("order_type"), o.get("customer_email"), zone, retailer, o.get("order_status"), o.get("payment_method") + " / " + o.get("payment_status"), rs(o.get("total_amount")), trip));
        }
        sb.append(table(List.of("Key / id", "Order number", "Type", "Customer", "Delivery zone", "Retailer", "Status", "Payment", "Total", "Trip"), ov));

        for (Map<String, Object> o : orders) {
            long id = ((Number) o.get("order_id")).longValue();
            sb.append("## ").append(label.get(id)).append(" - ").append(o.get("order_number")).append(" (id ").append(id).append(")\n\n");
            sb.append(table(List.of("Field", "Value"), List.of(
                    row("Type", o.get("order_type")), row("Customer", name(o.get("first_name"), o.get("last_name")) + " - " + o.get("customer_email")), row("Delivery address", o.get("delivery_address")),
                    row("Delivery position (lat, long)", o.get("delivery_latitude") + ", " + o.get("delivery_longitude")), row("Placed", o.get("order_date")), row("Status", o.get("order_status")),
                    row("Last update", o.get("updated_datetime")), row("Payment method / status", o.get("payment_method") + " / " + o.get("payment_status")), row("Payment reference", o.get("transaction_reference")),
                    row("Cancellation", o.get("cancellation_reason") == null ? "—" : o.get("cancellation_reason") + " (fee " + rs(o.get("cancellation_fee_amount")) + ", " + s(o.get("cancelled_datetime")) + ")"),
                    row("Status history", "`" + text(o.get("status_history_json")) + "`"))));
            if ("RETAIL".equals(o.get("order_type"))) {
                List<List<String>> items = new ArrayList<>();
                for (Map<String, Object> i : q("select i.sku_snapshot, i.product_name_snapshot, c.category_name, i.quantity, i.unit_price, i.discount_amount, i.line_total, i.weight_kg_snapshot, i.stock_restored, r.business_name from order_item i join products p on p.product_id = i.product_id join product_categories c on c.category_id = p.category_id join retailer r on r.retailer_id = i.retailer_id where i.order_id = ? order by i.order_item_id", id)) {
                    items.add(row(i.get("business_name"), i.get("sku_snapshot"), i.get("product_name_snapshot"), i.get("category_name"), i.get("quantity"), rs(i.get("unit_price")), rs(i.get("discount_amount")), rs(i.get("line_total")), i.get("weight_kg_snapshot") + " kg", i.get("stock_restored")));
                }
                sb.append(table(List.of("Retailer", "SKU", "Product", "Category", "Qty", "Unit price", "Discount", "Line total", "Weight", "Stock restored"), items));
            }
            sb.append(table(List.of("Subtotal", "Discount", "Tax", "Delivery fee", "Platform fee", "**Total**"), List.of(row(rs(o.get("subtotal_amount")), rs(o.get("discount_amount")), rs(o.get("tax_amount")), rs(o.get("delivery_charge")), rs(o.get("platform_fee_amount")), "**" + rs(o.get("total_amount")) + "**"))));
            Map<String, Object> pay = one("select payment_status, escrow_status, provider_reference, held_at, processed_at, amount from payment_transaction where order_id = ? and payment_status = 'SUCCESS'", id);
            List<Map<String, Object>> failed = q("select provider_reference, processed_at from payment_transaction where order_id = ? and payment_status = 'FAILED'", id);
            StringBuilder ps = new StringBuilder("Payment: ");
            if (!pay.isEmpty()) ps.append(pay.get("payment_status")).append(" / escrow ").append(pay.get("escrow_status")).append(", amount ").append(rs(pay.get("amount"))).append(", held ").append(s(pay.get("held_at"))).append(", released ").append(s(pay.get("processed_at"))).append(", reference ").append(pay.get("provider_reference"));
            else ps.append("no successful payment");
            for (Map<String, Object> f : failed) ps.append("; FAILED attempt ").append(f.get("provider_reference")).append(" at ").append(s(f.get("processed_at")));
            sb.append(ps).append(".\n\n");
            Map<String, Object> trip = one("select t.trip_number, t.trip_status, t.planned_start_at, t.actual_start_at, t.completed_at, t.distance_km, du.first_name, du.last_name, du.email as driver_email, v.registration_number, v.vehicle_type, f.business_name from trip t join driver d on d.driver_id = t.driver_id join user_account du on du.user_account_id = d.user_account_id join vehicle v on v.vehicle_id = t.vehicle_id join fleet_owner f on f.fleet_owner_id = t.fleet_owner_id where t.order_id = ?", id);
            sb.append(trip.isEmpty() ? "Trip: none (" + o.get("order_status") + ").\n\n" : "Trip: " + trip.get("trip_number") + " (" + trip.get("trip_status") + ") - driver " + name(trip.get("first_name"), trip.get("last_name")) + " (" + trip.get("driver_email") + "), vehicle " + trip.get("registration_number") + " " + trip.get("vehicle_type") + ", fleet " + trip.get("business_name") + ", " + trip.get("distance_km") + " km, planned " + s(trip.get("planned_start_at")) + ", started " + s(trip.get("actual_start_at")) + ", completed " + s(trip.get("completed_at")) + ".\n\n");
            Map<String, Object> inv = one("select invoice_number, invoice_date, subtotal_amount, tax_amount, total_amount, invoice_status from customer_invoice where order_id = ?", id);
            if (!inv.isEmpty()) sb.append("Invoice: ").append(inv.get("invoice_number")).append(" dated ").append(s(inv.get("invoice_date"))).append(", subtotal ").append(rs(inv.get("subtotal_amount"))).append(" + tax ").append(rs(inv.get("tax_amount"))).append(" = ").append(rs(inv.get("total_amount"))).append(" (").append(inv.get("invoice_status")).append(").\n\n");
        }
        write("ORDERS.md", sb.toString());
    }

    // ================================================================================== logistics

    static void logistics() throws Exception {
        StringBuilder sb = new StringBuilder("# Logistics: Bookings, Trips, Trip History (S4)\n\n" + GENERATED_NOTE
                + "Trips carry an order from the delivery-partner search to the door. A fleet owner accepts an order (`TripService.create`): the trip starts `PLANNED` (history row `null -> PLANNED`, no actor) and the order becomes `VEHICLE_ASSIGNED`; "
                + "the driver's pickup confirmation moves it to `IN_PROGRESS` (order `IN_TRANSIT`, pickup proof required); completing the delivery makes it `COMPLETED` (order `DELIVERED`, escrow release and settlements follow). "
                + "Every trip's driver, vehicle and fleet owner belong together, the vehicle's capacity covers the order's weight, and the driver is (or was) the vehicle's assignee. Pickup / delivery proofs are image data URIs (`data:image/png;base64,...`), as the application requires.\n\n## Logistics bookings (`logistics_booking_detail`)\n\n"
                + "Two FLEET_SERVICE orders where a customer books a vehicle directly: a delivered bike courier and a small-truck house move waiting for a driver. The delivery charge is `max(distance, minimum distance) x rate per km`, at least the minimum rate of the category (BIKE 10/km, min 2 km, min Rs 50; SMALL_TRUCK 20/km, min 5 km, min Rs 150).\n\n");
        for (Map<String, Object> b : q("select o.order_number, o.order_status, o.delivery_charge, o.total_amount, b.booking_type, b.receiver_name, b.receiver_phone_number, b.receiver_email, b.booking_locations_json, b.special_instructions, u.email as customer_email, v.registration_number, v.vehicle_type from logistics_booking_detail b join orders o on o.order_id = b.order_id join customer_profile cp on cp.customer_profile_id = o.customer_profile_id join user_account u on u.user_account_id = cp.user_account_id left join vehicle v on v.vehicle_id = b.vehicle_reference_id order by o.order_id")) {
            sb.append("### ").append(b.get("order_number")).append(" - ").append(b.get("booking_type")).append(" (").append(b.get("order_status")).append(")\n\n");
            sb.append(table(List.of("Field", "Value"), List.of(row("Customer", b.get("customer_email")), row("Vehicle reference", b.get("registration_number") + " (" + b.get("vehicle_type") + ")"), row("Receiver", b.get("receiver_name") + ", " + b.get("receiver_phone_number") + ", " + b.get("receiver_email")),
                    row("Locations", "`" + text(b.get("booking_locations_json")) + "`"), row("Special instructions", b.get("special_instructions")), row("Delivery charge / order total", rs(b.get("delivery_charge")) + " / " + rs(b.get("total_amount"))))));
        }
        sb.append("## Trips (`trip`)\n\n");
        List<List<String>> t = new ArrayList<>();
        for (Map<String, Object> r : q("select t.trip_number, o.order_number, o.order_type, t.trip_status, f.business_name, du.email as driver_email, v.registration_number, v.vehicle_type, v.capacity_kg, t.distance_km, t.planned_start_at, t.actual_start_at, t.completed_at, cu.email as created_by, t.assigned_by_account_id from trip t join orders o on o.order_id = t.order_id join fleet_owner f on f.fleet_owner_id = t.fleet_owner_id join driver d on d.driver_id = t.driver_id join user_account du on du.user_account_id = d.user_account_id join vehicle v on v.vehicle_id = t.vehicle_id join user_account cu on cu.user_account_id = t.created_by_account_id order by t.trip_number")) {
            t.add(row(r.get("trip_number"), r.get("order_number"), r.get("trip_status"), r.get("business_name"), r.get("driver_email"), r.get("registration_number") + " " + r.get("vehicle_type") + " (" + r.get("capacity_kg") + " kg)", r.get("distance_km") + " km", r.get("planned_start_at"), r.get("actual_start_at"), r.get("completed_at")));
        }
        sb.append(table(List.of("Trip", "Order", "Status", "Fleet owner", "Driver", "Vehicle", "Distance", "Planned", "Started", "Completed"), t));
        sb.append("## Trip status history (`trip_status_history`)\n\n");
        List<List<String>> h = new ArrayList<>();
        for (Map<String, Object> r : q("select t.trip_number, h.from_status, h.to_status, h.changed_at, u.email from trip_status_history h join trip t on t.trip_id = h.trip_id left join user_account u on u.user_account_id = h.changed_by_account_id order by t.trip_number, h.changed_at")) {
            h.add(row(r.get("trip_number"), r.get("from_status"), r.get("to_status"), r.get("changed_at"), r.get("email")));
        }
        sb.append(table(List.of("Trip", "From", "To", "Changed at", "Changed by"), h));
        write("LOGISTICS.md", sb.toString());
    }

    // ================================================================================== reviews

    static void reviews() throws Exception {
        StringBuilder sb = new StringBuilder("# Reviews (S3)\n\n" + GENERATED_NOTE
                + "A review requires the customer's own **DELIVERED** order that contains the product, and is unique per `(order, product)` (`ReviewServiceImpl`). Every review below references such an order, is dated after that order's delivery, and rates 1-5.\n\n");
        List<List<String>> rows = new ArrayList<>();
        for (Map<String, Object> r : q("select u.email, p.sku, p.product_name, o.order_number, o.order_status, o.updated_datetime as delivered, rv.rating, rv.review_text, rv.created_at from customer_review rv join orders o on o.order_id = rv.order_id join products p on p.product_id = rv.product_id join customer_profile cp on cp.customer_profile_id = rv.customer_id join user_account u on u.user_account_id = cp.user_account_id order by p.sku, rv.created_at")) {
            rows.add(row(r.get("email"), r.get("sku"), r.get("order_number"), r.get("delivered"), r.get("rating"), r.get("review_text"), r.get("created_at")));
        }
        sb.append(table(List.of("Customer", "Product SKU", "Order", "Delivered", "Rating", "Review", "Reviewed"), rows));
        sb.append("Quality flag: `PKG-BISCUIT-6PK` has 5 reviews averaging 4.8, so its `quality_flag` is `TRENDING`; no product qualifies for `LOW_RATED` (5+ reviews averaging 2.0 or less).\n");
        write("REVIEWS.md", sb.toString());
    }

    // ================================================================================== verification

    static void verification() throws Exception {
        StringBuilder sb = new StringBuilder("# Verification (S2)\n\n" + GENERATED_NOTE
                + "Every retailer, fleet owner, driver and vehicle has an APPROVED verification queue (29), reviewed by the Location Manager of its zone, with the documents its subject type requires "
                + "(`VerificationQueueServiceImpl.requiredDocumentTypes`): retailer 4 (`GST_CERTIFICATE`, `PAN_CARD`, `BUSINESS_LICENSE`, `ADDRESS_PROOF`), fleet owner 2 (`GST_NUMBER`, `PAN_CARD`), driver 1 (`DRIVING_LICENSE`), vehicle 1 (`INSURANCE`). "
                + "Each document is a small, structurally valid PDF stating that it is synthetic development data (no real personal document, no real number). An APPROVED queue is closed (`is_active = false`); its subject's own status (retailer `VERIFIED`, fleet owner `VERIFIED` + `ACTIVE`, driver / vehicle `ACTIVE`) is the result of the approval. "
                + "Southern Spice Market shows the full document history: its first business-licence upload was REJECTED (unreadable), the second was APPROVED - both versions are kept.\n\n## Queues by subject\n\n");
        List<List<String>> q = new ArrayList<>();
        for (Map<String, Object> r : q("select subject_type, verification_status, count(*) as n from verification_queue group by subject_type, verification_status order by subject_type")) q.add(row(r.get("subject_type"), r.get("verification_status"), r.get("n")));
        sb.append(table(List.of("Subject type", "Status", "Queues"), q));
        sb.append("## Queues and documents\n\n");
        List<List<String>> rows = new ArrayList<>();
        for (Map<String, Object> r : q("select q.subject_type, q.subject_id, q.verification_status, q.created_at, q.updated_at, z.zone_name, ru.email as reviewer, su.email as submitter, d.document_type_name, d.version_number, d.is_current_version, d.document_status, d.file_name, d.content_type, d.file_size_bytes, d.expiry_date, d.reject_reason, d.reviewer_comment, d.reviewed_at from verification_queue q join verification_document d on d.verification_queue_id = q.verification_queue_id join zone z on z.zone_id = q.zone_id left join user_account ru on ru.user_account_id = q.reviewed_by_account_id left join user_account su on su.user_account_id = q.submitted_by_account_id order by q.subject_type, q.created_at, d.document_type_name, d.version_number")) {
            String subject = subjectName((String) r.get("subject_type"), r.get("subject_id"));
            rows.add(row(r.get("subject_type"), subject, r.get("zone_name"), r.get("submitter"), r.get("reviewer"), r.get("verification_status"), r.get("document_type_name") + " v" + r.get("version_number") + (Boolean.TRUE.equals(r.get("is_current_version")) ? "" : " (superseded)"), r.get("document_status"), r.get("file_name") + " (" + r.get("file_size_bytes") + " bytes)", r.get("expiry_date"), r.get("reviewed_at")));
        }
        sb.append(table(List.of("Subject type", "Subject", "Zone", "Submitted by", "Reviewed by", "Queue", "Document", "Document status", "File", "Expiry", "Reviewed at"), rows));
        write("VERIFICATION.md", sb.toString());
    }

    static String subjectName(String type, Object id) throws SQLException {
        return switch (type) {
            case "RETAILER" -> s(one("select business_name from retailer where retailer_id = ?", id).get("business_name"));
            case "FLEET_OWNER" -> s(one("select business_name from fleet_owner where fleet_owner_id = ?", id).get("business_name"));
            case "DRIVER" -> s(one("select u.email from driver d join user_account u on u.user_account_id = d.user_account_id where d.driver_id = ?", id).get("email"));
            default -> s(one("select registration_number from vehicle where vehicle_id = ?", id).get("registration_number"));
        };
    }

    // ================================================================================== finance

    static void finance() throws Exception {
        StringBuilder sb = new StringBuilder("# Finance (S6)\n\n" + GENERATED_NOTE);
        sb.append("## Payments (`payment_transaction`)\n\nA payment is created `PENDING` / `NOT_HELD` with the order's total, captured to `SUCCESS` / `HELD`, and its escrow is `RELEASED` when the order is delivered (`PaymentTransactionServiceImpl`). "
                + "A failed attempt is `FAILED` and does not block a retry: O10's first card attempt failed and was retried successfully; O19's only attempt failed and the order was cancelled. FLEET_SERVICE order L2 is unpaid, so it has no payment.\n\n");
        List<List<String>> p = new ArrayList<>();
        for (Map<String, Object> r : q("select o.order_number, u.email, p.payment_method, p.payment_status, p.escrow_status, p.provider_reference, p.amount, p.currency_code, p.held_at, p.processed_at from payment_transaction p join orders o on o.order_id = p.order_id join customer_profile cp on cp.customer_profile_id = o.customer_profile_id join user_account u on u.user_account_id = cp.user_account_id order by o.order_id, p.payment_status")) {
            p.add(row(r.get("order_number"), r.get("email"), r.get("payment_method"), r.get("payment_status"), r.get("escrow_status"), r.get("provider_reference"), rs(r.get("amount")), r.get("currency_code"), r.get("held_at"), r.get("processed_at")));
        }
        sb.append(table(List.of("Order", "Customer", "Method", "Status", "Escrow", "Reference", "Amount", "Currency", "Held at", "Processed at"), p));

        sb.append("## Invoices (`customer_invoice`)\n\nAn invoice is `subtotal = the order's line totals`, `tax = the order's tax`, `total = subtotal + tax` (`CustomerInvoiceServiceImpl`; delivery and platform fee are not part of it). One per delivered retail order.\n\n");
        List<List<String>> i = new ArrayList<>();
        for (Map<String, Object> r : q("select i.invoice_number, o.order_number, u.email, i.invoice_date, i.subtotal_amount, i.tax_amount, i.total_amount, i.invoice_status from customer_invoice i join orders o on o.order_id = i.order_id join customer_profile cp on cp.customer_profile_id = o.customer_profile_id join user_account u on u.user_account_id = cp.user_account_id order by i.invoice_number")) {
            i.add(row(r.get("invoice_number"), r.get("order_number"), r.get("email"), r.get("invoice_date"), rs(r.get("subtotal_amount")), rs(r.get("tax_amount")), rs(r.get("total_amount")), r.get("invoice_status")));
        }
        sb.append(table(List.of("Invoice", "Order", "Customer", "Date", "Subtotal", "Tax", "Total", "Status"), i));

        sb.append("## Settlements (`settlement`)\n\nWhen an order is delivered the escrow is released and the money is split (`recordOrderDeliverySettlement`): a `RETAILER` payout per retailer (their line totals), a `FLEET_OWNER` payout (the delivery charge) and a `PLATFORM` share (platform fee + tax); "
                + "the payee's business name is what the Finance screen shows. Payouts older than eight days are `COMPLETED` (paid out three days after delivery), recent ones `PENDING`. "
                + "`operations_manager_id` is only used by the legacy request-based settlement flow, so it is NULL here.\n\n");
        List<List<String>> s = new ArrayList<>();
        for (Map<String, Object> r : q("select o.order_number, st.payee_type, st.payee_id, st.settlement_reference, st.gross_amount, st.fee_amount, st.net_amount, st.settlement_status, st.settlement_date, st.created_at, st.completed_at from settlement st join payment_transaction p on p.payment_transaction_id = st.payment_transaction_id join orders o on o.order_id = p.order_id order by o.order_id, st.payee_type")) {
            String payee = "PLATFORM".equals(r.get("payee_type")) ? "AroundU Platform" : subjectName("RETAILER".equals(r.get("payee_type")) ? "RETAILER" : "FLEET_OWNER", r.get("payee_id"));
            s.add(row(r.get("order_number"), r.get("payee_type"), payee, rs(r.get("gross_amount")), rs(r.get("fee_amount")), rs(r.get("net_amount")), r.get("settlement_status"), r.get("settlement_date"), r.get("completed_at")));
        }
        sb.append(table(List.of("Order", "Payee type", "Payee", "Gross", "Fee", "Net", "Status", "Date", "Completed"), s));

        sb.append("## Refunds (`customer_refund`)\n\nA refund is requested for one order item of a ticket's order (`REQUESTED`), then approved and completed, or rejected with the reason appended; the item's category is appended to the reason by the application. Four refunds cover all four states.\n\n");
        List<List<String>> f = new ArrayList<>();
        for (Map<String, Object> r : q("select r.refund_reference, t.ticket_number, o.order_number, i.sku_snapshot, i.line_total, r.refund_amount, r.refund_status, r.reason, r.requested_at, r.processed_at from customer_refund r join support_ticket t on t.customer_ticket_id = r.customer_ticket_id join payment_transaction p on p.payment_transaction_id = r.payment_transaction_id join orders o on o.order_id = p.order_id join order_item i on i.order_item_id = r.order_item_id order by r.refund_reference")) {
            f.add(row(r.get("refund_reference"), r.get("ticket_number"), r.get("order_number"), r.get("sku_snapshot"), rs(r.get("line_total")), rs(r.get("refund_amount")), r.get("refund_status"), r.get("reason"), r.get("requested_at"), r.get("processed_at")));
        }
        sb.append(table(List.of("Refund", "Ticket", "Order", "Item", "Item total", "Refund", "Status", "Reason", "Requested", "Processed"), f));

        sb.append("## Money overview\n\n");
        List<List<String>> m = new ArrayList<>();
        for (Map<String, Object> r : q("select order_type, order_status, count(*) as orders, sum(subtotal_amount) as sub, sum(tax_amount) as tax, sum(delivery_charge) as dl, sum(platform_fee_amount) as pf, sum(discount_amount) as di, sum(total_amount) as total from orders group by order_type, order_status order by order_type, order_status")) {
            m.add(row(r.get("order_type"), r.get("order_status"), r.get("orders"), rs(r.get("sub")), rs(r.get("tax")), rs(r.get("dl")), rs(r.get("pf")), rs(r.get("di")), rs(r.get("total"))));
        }
        sb.append(table(List.of("Type", "Status", "Orders", "Subtotal", "Tax", "Delivery", "Platform fee", "Discount", "Total"), m));
        write("FINANCE.md", sb.toString());
    }

    // ================================================================================== support

    static void support() throws Exception {
        StringBuilder sb = new StringBuilder("# Support (S6)\n\n" + GENERATED_NOTE
                + "Eleven tickets covering every status (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`), all four raiser roles the taxonomy validates (customer, retailer, fleet owner, driver) and both escalation styles. "
                + "Category / sub-category always come from `SupportTicketCategories` for the raiser's role. `due_by` = raised + the priority's SLA (LOW 72 h, MEDIUM 24 h, HIGH 4 h). Only ticket T11 is `OPEN` (LOW, well within its SLA), so the SLA scheduler will not touch the seeded data.\n\n## Tickets\n\n");
        List<List<String>> t = new ArrayList<>();
        for (Map<String, Object> r : q("select t.ticket_number, t.raised_by_role, ru.email as raiser, t.ticket_category, t.ticket_sub_category, t.priority, t.ticket_status, su.email as assignee, o.order_number, t.subject, t.raised_at, t.due_by, t.resolved_at, t.escalated_to_role, t.escalated_to_entity_type, t.escalation_reason, t.escalated_at, t.cluster_incident_id from support_ticket t join user_account ru on ru.user_account_id = t.raised_by_account_id left join user_account su on su.user_account_id = t.assigned_support_account_id left join orders o on o.order_id = t.order_id order by t.ticket_number")) {
            String esc = r.get("escalated_to_role") != null ? "role " + r.get("escalated_to_role") : r.get("escalated_to_entity_type") != null ? "entity " + r.get("escalated_to_entity_type") : "—";
            t.add(row(r.get("ticket_number"), r.get("raised_by_role") + ": " + r.get("raiser"), r.get("ticket_category") + " / " + r.get("ticket_sub_category"), r.get("priority"), r.get("ticket_status"), r.get("assignee"), r.get("order_number"), r.get("subject"), r.get("raised_at"), r.get("due_by"), r.get("resolved_at"), esc, r.get("cluster_incident_id") != null ? "yes" : "no"));
        }
        sb.append(table(List.of("Ticket", "Raised by", "Category / sub-category", "Priority", "Status", "Assigned to", "Order", "Subject", "Raised", "Due by", "Resolved", "Escalated to", "In cluster"), t));

        sb.append("## Ticket descriptions and conversations (`support_ticket_message`)\n\n");
        for (Map<String, Object> r : q("select t.customer_ticket_id, t.ticket_number, t.subject, t.description from support_ticket t order by t.ticket_number")) {
            sb.append("### ").append(r.get("ticket_number")).append(" - ").append(r.get("subject")).append("\n\n> ").append(r.get("description")).append("\n\n");
            List<List<String>> m = new ArrayList<>();
            for (Map<String, Object> x : q("select m.sent_at, m.sender_role, u.email, m.internal_note, m.message from support_ticket_message m left join user_account u on u.user_account_id = m.sender_account_id where m.customer_ticket_id = ? order by m.sent_at", r.get("customer_ticket_id"))) {
                m.add(row(x.get("sent_at"), x.get("sender_role"), x.get("email"), x.get("internal_note"), x.get("message")));
            }
            sb.append(table(List.of("Sent", "Sender role", "Sender", "Internal note", "Message"), m));
        }

        sb.append("## Ticket cluster incident (`ticket_cluster_incident`)\n\nThree or more distinct raisers of the same category and sub-category in one zone within 48 hours form an ACTIVE incident (`TicketClusterServiceImpl`, `MIN_DISTINCT_RAISERS = 3`). "
                + "T5, T6 and T7 are late-delivery complaints of three different customers of **West** Bengaluru raised within a day; the incident groups them and the three tickets point back to it through `cluster_incident_id`. "
                + "The application's own scheduler re-evaluates incidents with the real clock: once the 48-hour window has passed it marks the incident RESOLVED, exactly as it would for a genuine cluster (the seeder never creates a second one).\n\n");
        List<List<String>> cl = new ArrayList<>();
        for (Map<String, Object> r : q("select c.ticket_category, c.ticket_sub_category, c.territory_key, ci.city_name, z.zone_name, c.ticket_count, c.distinct_raiser_count, c.first_seen_at, c.last_seen_at, c.detected_at, c.last_evaluated_at, c.incident_status, c.resolved_at from ticket_cluster_incident c join city ci on ci.city_id = c.city_id join zone z on z.zone_id = c.zone_id")) {
            cl.add(row(r.get("ticket_category") + " / " + r.get("ticket_sub_category"), r.get("zone_name") + ", " + r.get("city_name"), r.get("territory_key"), r.get("ticket_count"), r.get("distinct_raiser_count"), r.get("first_seen_at"), r.get("last_seen_at"), r.get("detected_at"), r.get("last_evaluated_at"), r.get("incident_status")));
        }
        sb.append(table(List.of("Category / sub-category", "Zone", "Territory key", "Tickets", "Distinct raisers", "First seen", "Last seen", "Detected", "Last evaluated", "Status"), cl));
        write("SUPPORT.md", sb.toString());
    }

    // ================================================================================== notifications + audit

    static void notificationsAndAudit() throws Exception {
        StringBuilder sb = new StringBuilder("# Notifications and Audit Log (S6)\n\n" + GENERATED_NOTE
                + "## Notifications (`notifications`)\n\nThe notifications the application sends along an order's life (`OrderService`, `TripService`, `PaymentTransactionService`, `SupportTicketServiceImpl`): "
                + "to the retailer when an order arrives (`ORDER_RECEIVED`), to the customer for payment (`PAYMENT`), acceptance / rejection / cancellation, pickup (`ORDER_PICKED_UP`) and delivery (`DELIVERED`), "
                + "to the fleet owner for a delivery request (`DELIVERY_REQUEST`), and the ticket events (`SUPPORT_TICKET_ASSIGNED / RESOLVED / CLOSED / ESCALATED`). Notifications older than two days are `read`, newer ones unread.\n\n");
        List<List<String>> n = new ArrayList<>();
        for (Map<String, Object> r : q("select role, notification_type, reference_type, count(*) as total, sum(case when read then 1 else 0 end) as read_count from notifications group by role, notification_type, reference_type order by role, notification_type")) {
            n.add(row(r.get("role"), r.get("notification_type"), r.get("reference_type"), r.get("total"), r.get("read_count")));
        }
        sb.append(table(List.of("Recipient role", "Type", "Reference", "Notifications", "Read"), n));
        sb.append("Recent notifications of the seeded customers (sample):\n\n");
        List<List<String>> s = new ArrayList<>();
        for (Map<String, Object> r : q("select u.email, x.role, x.notification_type, x.title, x.message, x.read, x.sent_at from notifications x join user_account u on u.user_account_id = x.user_account_id where x.role = 'CUSTOMER' order by x.sent_at desc limit 12")) {
            s.add(row(r.get("email"), r.get("notification_type"), r.get("title"), r.get("message"), r.get("read"), r.get("sent_at")));
        }
        sb.append(table(List.of("Recipient", "Type", "Title", "Message", "Read", "Sent"), s));
        sb.append("## Audit log (`audit_log`)\n\nIn this application every audit row is written by the frontend's audit interceptor after an internal role performs a business action: `action` is the readable name, `source_module` the area, "
                + "`new_values` the technical request (`{\"status\", \"role\", \"request\": \"METHOD path\"}`), `old_values` is always NULL and `ip_address` is filled here with internal addresses. All actors are real seeded staff accounts.\n\n");
        List<List<String>> a = new ArrayList<>();
        for (Map<String, Object> r : q("select a.performed_at, u.email, a.action, a.source_module, a.new_values, a.ip_address from audit_log a join user_account u on u.user_account_id = a.user_account_id order by a.performed_at")) {
            a.add(row(r.get("performed_at"), r.get("email"), r.get("action"), r.get("source_module"), "`" + r.get("new_values") + "`", r.get("ip_address")));
        }
        sb.append(table(List.of("Performed at", "Actor", "Action", "Module", "Details", "IP"), a));
        write("NOTIFICATIONS_AND_AUDIT.md", sb.toString());
    }
}
