package com.cbg.lbos.seed;

import static com.cbg.lbos.seed.SeedSupport.IST;
import static com.cbg.lbos.seed.SeedSupport.LOG;
import static com.cbg.lbos.seed.SeedSupport.PASSWORD;
import static com.cbg.lbos.seed.SeedSupport.at;
import static com.cbg.lbos.seed.SeedSupport.exists;
import static com.cbg.lbos.seed.SeedSupport.ts;

import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * S1 - Platform &amp; Territory: the development identity and territory data (see seed-data/).
 *
 * <ul>
 *   <li>Territory: 3 states, 3 cities, exactly 4 zones (North, South, West, East).</li>
 *   <li>Accounts: the platform staff, Operations / Location Managers and every partner and customer login of the
 *       other services - all with the development password, stored as the application stores it
 *       (the delegating {@link PasswordEncoder}, i.e. BCrypt).</li>
 *   <li>Operations Managers, Location Managers and one Location Manager transfer history row.</li>
 * </ul>
 *
 * Ids are generated the way the application generates them (random UUIDs), and every row is looked up by its
 * business key (state / city / zone name, account email) so the seeder can run on every start without creating
 * duplicates. Rows are inserted with JDBC, not through the entities, because the seed backdates created/updated
 * timestamps that the entities' lifecycle callbacks would overwrite with "now".
 */
@Component
@Order(1)
public class DataSeeder implements ApplicationRunner {

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(JdbcTemplate jdbc, PasswordEncoder passwordEncoder) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
    }

    // ---- territory ---------------------------------------------------------------------------------------------

    private static final String[][] STATES = {
            {"Tamil Nadu", "IN"}, {"Karnataka", "IN"}, {"Telangana", "IN"}};

    /** city, state */
    private static final String[][] CITIES = {
            {"Chennai", "Tamil Nadu"}, {"Bengaluru", "Karnataka"}, {"Hyderabad", "Telangana"}};

    /** zone, city - the only four zones of the platform */
    private static final String[][] ZONES = {
            {"North", "Chennai"}, {"South", "Chennai"}, {"West", "Bengaluru"}, {"East", "Hyderabad"}};

    // ---- accounts ----------------------------------------------------------------------------------------------

    /** email, phone, first name, last name, role, created (days ago), self-registered (terms accepted), last login (days ago, -1 = never) */
    private static final Object[][] USERS = {
            // platform staff
            {"admin@lbos.com", "9810000001", "Rohan", "Mehta", "SUPER_ADMIN", 120, false, 0},
            {"support1@lbos.com", "9810000002", "Ananya", "Krishnan", "SUPPORT_STAFF", 110, false, 0},
            {"support2@lbos.com", "9810000003", "Imran", "Sheikh", "SUPPORT_STAFF", 110, false, 1},
            // operations managers
            {"op.ch@lbos.com", "9840011001", "Suresh", "Venkataraman", "OPERATIONS_MANAGER", 100, false, 0},
            {"op.ba@lbos.com", "9880011002", "Lakshmi", "Narayanan", "OPERATIONS_MANAGER", 100, false, 1},
            {"op.hy@lbos.com", "9848011003", "Srinivas", "Reddy", "OPERATIONS_MANAGER", 100, false, 2},
            // location managers
            {"lm1.chn@lbos.com", "9840022001", "Karthik", "Subramanian", "LOCATION_MANAGER", 80, false, 0},
            {"lm2.chn@lbos.com", "9840022002", "Divya", "Ramesh", "LOCATION_MANAGER", 95, false, 1},
            {"lm1.baw@lbos.com", "9880022003", "Manjunath", "Gowda", "LOCATION_MANAGER", 90, false, 0},
            {"lm1.hye@lbos.com", "9848022004", "Venkatesh", "Rao", "LOCATION_MANAGER", 90, false, 1},
            // retailers
            {"retailer1.chn@lbos.com", "9840033001", "Arjun", "Balasubramanian", "RETAILER", 75, true, 0},
            {"retailer2.baw@lbos.com", "9880033002", "Prakash", "Shetty", "RETAILER", 74, true, 0},
            {"retailer3.hye@lbos.com", "9848033003", "Sravani", "Chowdary", "RETAILER", 73, true, 1},
            {"retailer4.chs@lbos.com", "9840033004", "Ramya", "Iyer", "RETAILER", 70, true, 1},
            {"retailer5.chn@lbos.com", "9840033005", "Mohammed", "Faizal", "RETAILER", 68, true, 0},
            // fleet owners
            {"fleet1.baw@lbos.com", "9880044001", "Ravi Kumar", "Naidu", "FLEET_MANAGER", 72, true, 0},
            {"fleet2.hye@lbos.com", "9848044002", "Naveen", "Goud", "FLEET_MANAGER", 71, true, 1},
            {"fleet3.chn@lbos.com", "9840044003", "Senthil", "Murugan", "FLEET_MANAGER", 71, true, 0},
            // drivers (created by their fleet owner, activated after document verification)
            {"driver1fleet1.baw@lbos.com", "9880066011", "Harish", "Kumar", "DRIVER", 60, false, 0},
            {"driver2fleet1.baw@lbos.com", "9880066012", "Mahesh", "Babu", "DRIVER", 60, false, 1},
            {"driver3fleet1.baw@lbos.com", "9880066013", "Ganesh", "Naik", "DRIVER", 58, false, 0},
            {"driver1fleet2.hye@lbos.com", "9848066021", "Anil", "Kumar Yadav", "DRIVER", 60, false, 0},
            {"driver2fleet2.hye@lbos.com", "9848066022", "Mohammed", "Irfan", "DRIVER", 59, false, 2},
            {"driver3fleet2.hye@lbos.com", "9848066023", "Vamsi", "Krishna", "DRIVER", 57, false, 1},
            {"driver1fleet3.chn@lbos.com", "9840066031", "Murugan", "Selvam", "DRIVER", 61, false, 0},
            {"driver2fleet3.chn@lbos.com", "9840066032", "Prakash", "Raj", "DRIVER", 61, false, 0},
            {"driver3fleet3.chn@lbos.com", "9840066033", "Arun", "Pandian", "DRIVER", 59, false, 1},
            // customers
            {"customer1.chn@lbos.com", "9840055001", "Priya", "Ramanathan", "CUSTOMER", 55, true, 0},
            {"customer2.baw@lbos.com", "9880055002", "Rahul", "Deshpande", "CUSTOMER", 54, true, 0},
            {"customer3.hye@lbos.com", "9848055003", "Anjali", "Reddy", "CUSTOMER", 50, true, 1},
            {"customer4.chn@lbos.com", "9840055004", "Vignesh", "Kannan", "CUSTOMER", 48, true, 0},
            {"customer5.chs@lbos.com", "9840055005", "Sneha", "Raghavan", "CUSTOMER", 45, true, 2},
            {"customer6.baw@lbos.com", "9880055006", "Aditya", "Hegde", "CUSTOMER", 42, true, 1},
            {"customer7.baw@lbos.com", "9880055007", "Kavya", "Bhat", "CUSTOMER", 40, true, 0},
    };

    /** operations manager email, city */
    private static final String[][] OPERATIONS_MANAGERS = {
            {"op.ch@lbos.com", "Chennai"}, {"op.ba@lbos.com", "Bengaluru"}, {"op.hy@lbos.com", "Hyderabad"}};

    /** location manager email, city, zone, operations manager email, assigned (days ago) */
    private static final Object[][] LOCATION_MANAGERS = {
            {"lm1.chn@lbos.com", "Chennai", "North", "op.ch@lbos.com", 72},
            {"lm2.chn@lbos.com", "Chennai", "South", "op.ch@lbos.com", 74},
            {"lm1.baw@lbos.com", "Bengaluru", "West", "op.ba@lbos.com", 88},
            {"lm1.hye@lbos.com", "Hyderabad", "East", "op.hy@lbos.com", 88},
    };

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        for (String[] state : STATES) seedState(state[0], state[1]);
        for (String[] city : CITIES) seedCity(city[0], city[1]);
        for (String[] zone : ZONES) seedZone(zone[0], zone[1]);
        for (Object[] user : USERS) seedUser(user);
        for (String[] om : OPERATIONS_MANAGERS) seedOperationsManager(om[0], om[1]);
        for (Object[] lm : LOCATION_MANAGERS) seedLocationManager(lm);
        seedLocationManagerTransferHistory();
        LOG.info("S1 seed: {} states, {} cities, {} zones, {} accounts", STATES.length, CITIES.length, ZONES.length, USERS.length);
    }

    private UUID stateId(String name) {
        return jdbc.queryForObject("select state_id from state where state_name = ?", UUID.class, name);
    }

    private UUID cityId(String name) {
        return jdbc.queryForObject("select city_id from city where city_name = ?", UUID.class, name);
    }

    private UUID zoneId(String cityName, String zoneName) {
        return jdbc.queryForObject("select z.zone_id from zone z join city c on c.city_id = z.city_id "
                + "where c.city_name = ? and z.zone_name = ?", UUID.class, cityName, zoneName);
    }

    private UUID accountId(String email) {
        return jdbc.queryForObject("select user_account_id from user_account where email = ?", UUID.class, email);
    }

    private void seedState(String name, String countryCode) {
        if (exists(jdbc, "select count(*) from state where state_name = ?", name)) return;
        jdbc.update("insert into state(state_id, state_name, country_code, is_active) values (?,?,?,?)",
                UUID.randomUUID(), name, countryCode, true);
    }

    private void seedCity(String name, String stateName) {
        if (exists(jdbc, "select count(*) from city where city_name = ?", name)) return;
        jdbc.update("insert into city(city_id, state_id, city_name, is_active) values (?,?,?,?)",
                UUID.randomUUID(), stateId(stateName), name, true);
    }

    private void seedZone(String name, String cityName) {
        UUID cityId = cityId(cityName);
        if (exists(jdbc, "select count(*) from zone where city_id = ? and zone_name = ?", cityId, name)) return;
        jdbc.update("insert into zone(zone_id, city_id, zone_name, is_active) values (?,?,?,?)",
                UUID.randomUUID(), cityId, name, true);
    }

    private void seedUser(Object[] u) {
        String email = (String) u[0];
        if (exists(jdbc, "select count(*) from user_account where email = ?", email)) {
            keepSeedPasswordCurrent(email);
            return;
        }
        int createdDaysAgo = (Integer) u[5];
        boolean selfRegistered = (Boolean) u[6];
        int lastLoginDaysAgo = (Integer) u[7];
        OffsetDateTime created = at(createdDaysAgo, 10, 15);
        OffsetDateTime lastLogin = lastLoginDaysAgo < 0 ? null : at(lastLoginDaysAgo, 9, 40);
        jdbc.update(
                "insert into user_account(user_account_id, email, phone_number, password_hash, first_name, last_name, "
                        + "role, account_status, password_changed_on, last_login_at, terms_accepted_at, created_at, updated_at) "
                        + "values (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                UUID.randomUUID(), email, u[1], passwordEncoder.encode(PASSWORD), u[2], u[3], u[4], "ACTIVE",
                ts(passwordSetOn(createdDaysAgo)), ts(lastLogin), selfRegistered ? ts(created.plusMinutes(2)) : null, ts(created),
                ts(lastLogin != null ? lastLogin : created));
    }

    /**
     * The login rejects a password older than 90 days ({@code AuthController.MAX_PASSWORD_AGE_DAYS}) by the REAL clock,
     * so the seed dates the password relative to the moment it is seeded, not to the fixed dataset moment - otherwise
     * every account created more than 90 days before the dataset moment could not log in.
     */
    private static OffsetDateTime passwordSetOn(int accountCreatedDaysAgo) {
        return OffsetDateTime.now(IST).minusDays(Math.min(accountCreatedDaysAgo, 14));
    }

    /**
     * A development database outlives the 90-day password age: when a seed account still has the seed password but its
     * password has become old, it is treated as freshly changed. An account whose password was changed by someone
     * (the hash no longer matches) is never touched.
     */
    private void keepSeedPasswordCurrent(String email) {
        jdbc.query("select password_hash, password_changed_on from user_account where email = ?", rs -> {
            OffsetDateTime changedOn = rs.getObject("password_changed_on", OffsetDateTime.class);
            boolean old = changedOn == null || changedOn.isBefore(OffsetDateTime.now(IST).minusDays(30));
            if (old && passwordEncoder.matches(PASSWORD, rs.getString("password_hash"))) {
                jdbc.update("update user_account set password_changed_on = ? where email = ?",
                        ts(OffsetDateTime.now(IST).minusDays(1)), email);
            }
        }, email);
    }

    private void seedOperationsManager(String email, String cityName) {
        UUID accountId = accountId(email);
        if (exists(jdbc, "select count(*) from operations_manager where user_account_id = ?", accountId)) return;
        OffsetDateTime assigned = at(98, 11, 0);
        jdbc.update("insert into operations_manager(operations_manager_id, user_account_id, city_id, assignment_status, "
                        + "assigned_at, updated_at, version) values (?,?,?,?,?,?,?)",
                UUID.randomUUID(), accountId, cityId(cityName), "ACTIVE", ts(assigned), ts(assigned), 0L);
    }

    private void seedLocationManager(Object[] lm) {
        UUID accountId = accountId((String) lm[0]);
        if (exists(jdbc, "select count(*) from location_manager where user_account_id = ?", accountId)) return;
        UUID omId = jdbc.queryForObject("select operations_manager_id from operations_manager where user_account_id = ?",
                UUID.class, accountId((String) lm[3]));
        jdbc.update("insert into location_manager(location_manager_id, user_account_id, zone_id, operations_manager_id, "
                        + "assignment_status, assigned_at) values (?,?,?,?,?,?)",
                UUID.randomUUID(), accountId, zoneId((String) lm[1], (String) lm[2]), omId, "ACTIVE",
                ts(at((Integer) lm[4], 11, 30)));
    }

    /**
     * lm2.chn started as Chennai's North officer and was moved to the South zone when lm1.chn was hired for North -
     * the row a real transfer (PUT /api/v1/location-managers/{id}/transfer) leaves behind.
     */
    private void seedLocationManagerTransferHistory() {
        UUID locationManagerId = jdbc.queryForObject(
                "select location_manager_id from location_manager where user_account_id = ?", UUID.class, accountId("lm2.chn@lbos.com"));
        if (exists(jdbc, "select count(*) from location_manager_assignment_history where location_manager_id = ?", locationManagerId)) return;
        UUID omId = jdbc.queryForObject("select operations_manager_id from operations_manager where user_account_id = ?",
                UUID.class, accountId("op.ch@lbos.com"));
        jdbc.update("insert into location_manager_assignment_history(history_id, location_manager_id, from_zone_id, "
                        + "from_zone_name, from_city_name, from_operations_manager_id, from_assigned_at, to_zone_id, "
                        + "to_zone_name, to_city_name, to_operations_manager_id, changed_at) values (?,?,?,?,?,?,?,?,?,?,?,?)",
                UUID.randomUUID(), locationManagerId, zoneId("Chennai", "North"), "North", "Chennai", omId, ts(at(95, 11, 30)),
                zoneId("Chennai", "South"), "South", "Chennai", omId, ts(at(74, 11, 30)));
    }
}
