package com.cbg.lbos.seed;

import static com.cbg.lbos.seed.SeedSupport.LOG;
import static com.cbg.lbos.seed.SeedSupport.await;
import static com.cbg.lbos.seed.SeedSupport.at;
import static com.cbg.lbos.seed.SeedSupport.exists;
import static com.cbg.lbos.seed.SeedSupport.runAsync;
import static com.cbg.lbos.seed.SeedSupport.syntheticPdf;
import static com.cbg.lbos.seed.SeedSupport.ts;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
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
 * S5 - Fleet Operations: the drivers, vehicles, driver-vehicle assignments and fleet expenses of the three seeded
 * fleet owners (see seed-data/FLEET.md).
 *
 * Every fleet owner has 3 drivers and 4 vehicles: two mini trucks and one light truck (four-wheelers) and one bike
 * (two-wheeler). Two drivers hold an ACTIVE assignment on a mini truck, the third on the bike; the light truck is
 * free, and the third driver's earlier assignment on it is kept as an ENDED row. Fleet owner rows come from S2 and
 * accounts / cities from S1, found by business key. Drivers and vehicles are ACTIVE (their verification, seeded by
 * S2, is APPROVED) and their owners are VERIFIED / ACTIVE, the state S5's DriverServiceImpl.create() requires.
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

    /** One fleet: owner email, city, zone, base latitude / longitude, the Location Manager of the zone, the Operations Manager of the city. */
    private record Fleet(String ownerEmail, String city, String zone, String lat, String lon, String locationManager,
                         String operationsManager, String[] driverEmails, String[] licenseNumbers, String[] licenseExpiries,
                         String[] commissions, String[][] vehicles) {
    }

    /** vehicle: registration no., type, make, model, model year, capacity kg */
    private static final Fleet[] FLEETS = {
            new Fleet("fleet1.baw@lbos.com", "Bengaluru", "West", "12.99", "77.55", "lm1.baw@lbos.com", "op.ba@lbos.com",
                    new String[] {"driver1fleet1.baw@lbos.com", "driver2fleet1.baw@lbos.com", "driver3fleet1.baw@lbos.com"},
                    new String[] {"KA0520190041256", "KA0220200018834", "KA0420180029947"},
                    new String[] {"2029-06-14", "2030-02-27", "2028-11-05"},
                    new String[] {"78.00", "80.00", "75.00"},
                    new String[][] {
                            {"KA05JK4471", "MINI_TRUCK", "Tata", "Ace Gold", "2022", "750.00"},
                            {"KA02MN8125", "MINI_TRUCK", "Mahindra", "Jeeto", "2021", "700.00"},
                            {"KA04HT6093", "TRUCK", "Eicher", "Pro 2049", "2020", "2500.00"},
                            {"KA01EW3388", "BIKE", "Hero", "Splendor Plus", "2023", "30.00"}}),
            new Fleet("fleet2.hye@lbos.com", "Hyderabad", "East", "17.41", "78.56", "lm1.hye@lbos.com", "op.hy@lbos.com",
                    new String[] {"driver1fleet2.hye@lbos.com", "driver2fleet2.hye@lbos.com", "driver3fleet2.hye@lbos.com"},
                    new String[] {"TS0820190053871", "TS0920210012365", "TS0720200047719"},
                    new String[] {"2029-09-30", "2031-03-18", "2030-07-22"},
                    new String[] {"80.00", "76.00", "78.00"},
                    new String[][] {
                            {"TS08UB2210", "MINI_TRUCK", "Tata", "Ace Gold", "2022", "750.00"},
                            {"TS09FQ7754", "MINI_TRUCK", "Ashok Leyland", "Dost", "2021", "1250.00"},
                            {"TS07JH1149", "TRUCK", "Eicher", "Pro 2049", "2019", "2500.00"},
                            {"TS10ER5602", "BIKE", "Honda", "Shine 125", "2023", "30.00"}}),
            new Fleet("fleet3.chn@lbos.com", "Chennai", "North", "13.11", "80.24", "lm1.chn@lbos.com", "op.ch@lbos.com",
                    new String[] {"driver1fleet3.chn@lbos.com", "driver2fleet3.chn@lbos.com", "driver3fleet3.chn@lbos.com"},
                    new String[] {"TN0920180061024", "TN0220200035518", "TN0720190024463"},
                    new String[] {"2028-12-09", "2030-05-16", "2029-10-01"},
                    new String[] {"80.00", "78.00", "76.00"},
                    new String[][] {
                            {"TN09BX5316", "MINI_TRUCK", "Tata", "Ace Gold", "2022", "750.00"},
                            {"TN02CK9942", "MINI_TRUCK", "Mahindra", "Jeeto", "2023", "700.00"},
                            {"TN07AT6178", "TRUCK", "Eicher", "Pro 2049", "2020", "2500.00"},
                            {"TN22DM4085", "BIKE", "Honda", "Shine 125", "2022", "30.00"}}),
    };

    /** per fleet, 4 expenses: vehicle index, driver index (-1 = none), type, amount, days ago, status, description-less proof name */
    private static final Object[][][] EXPENSES = {
            {{0, 0, "FUEL", "2450.00", 12, "APPROVED"}, {2, -1, "MAINTENANCE", "8600.00", 9, "PENDING"},
                    {1, 1, "TOLL", "380.00", 6, "APPROVED"}, {0, -1, "REPAIR", "3200.00", 20, "REJECTED"}},
            {{0, 0, "FUEL", "2875.00", 14, "APPROVED"}, {1, 1, "PARKING", "220.00", 8, "APPROVED"},
                    {2, -1, "INSURANCE", "9400.00", 5, "PENDING"}, {3, 2, "DRIVER_ALLOWANCE", "1500.00", 16, "CANCELLED"}},
            {{0, 0, "FUEL", "2320.00", 11, "APPROVED"}, {1, 1, "TOLL", "260.00", 7, "APPROVED"},
                    {2, -1, "MAINTENANCE", "6750.00", 4, "PENDING"}, {3, 2, "FUEL", "540.00", 3, "PENDING"}},
    };

    /** The seeding runs on a background thread, so S5 starts without waiting for the other services. */
    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            LOG.info("S5 seed skipped (app.seed.enabled=false)");
            return;
        }
        runAsync("seed-s5", this::seedAll);
    }

    private void seedAll() {
        int drivers = 0;
        int vehicles = 0;
        for (int f = 0; f < FLEETS.length; f++) {
            Fleet fleet = FLEETS[f];
            UUID ownerAccount = account(fleet.ownerEmail());
            UUID fleetOwnerId = await(jdbc, "fleet owner of " + fleet.ownerEmail(), UUID.class,
                    "select fleet_owner_id from fleet_owner where user_account_id = ?", ownerAccount);
            UUID cityId = await(jdbc, "city " + fleet.city(), UUID.class, "select city_id from city where city_name = ?", fleet.city());
            UUID reviewer = account(fleet.locationManager());
            UUID approver = account(fleet.operationsManager());

            List<UUID> vehicleIds = new ArrayList<>();
            for (int v = 0; v < fleet.vehicles().length; v++) {
                vehicleIds.add(seedVehicle(fleetOwnerId, ownerAccount, fleet, fleet.vehicles()[v], v));
                vehicles++;
            }
            List<UUID> driverIds = new ArrayList<>();
            for (int d = 0; d < fleet.driverEmails().length; d++) {
                driverIds.add(seedDriver(fleetOwnerId, cityId, reviewer, fleet, d));
                drivers++;
            }
            seedAssignments(ownerAccount, fleet, vehicleIds, driverIds);
            for (Object[] e : EXPENSES[f]) {
                seedExpense(fleetOwnerId, ownerAccount, approver, vehicleIds, driverIds, e);
            }
        }
        LOG.info("S5 seed: {} drivers, {} vehicles, {} assignments, {} expenses", drivers, vehicles, FLEETS.length * 4, FLEETS.length * 4);
    }

    private UUID account(String email) {
        return await(jdbc, "account " + email, UUID.class, "select user_account_id from user_account where email = ?", email);
    }

    private UUID seedVehicle(UUID fleetOwnerId, UUID ownerAccount, Fleet fleet, String[] v, int index) {
        UUID existing = jdbc.query("select vehicle_id from vehicle where registration_number = ?",
                rs -> rs.next() ? (UUID) rs.getObject(1) : null, v[0]);
        if (existing != null) return existing;
        UUID id = UUID.randomUUID();
        jdbc.update("insert into vehicle(vehicle_id, fleet_owner_id, updated_by_account_id, registration_number, vehicle_type, make, "
                        + "model, model_year, capacity_kg, vehicle_status, latitude, longitude) values (?,?,?,?,?,?,?,?,?,?,?,?)",
                id, fleetOwnerId, ownerAccount, v[0], v[1], v[2], v[3], Integer.parseInt(v[4]), new BigDecimal(v[5]), "ACTIVE",
                new BigDecimal(fleet.lat()).add(BigDecimal.valueOf(index + 1, 2)),
                new BigDecimal(fleet.lon()).add(BigDecimal.valueOf(index + 1, 2)));
        return id;
    }

    private UUID seedDriver(UUID fleetOwnerId, UUID cityId, UUID verifiedBy, Fleet fleet, int index) {
        UUID accountId = account(fleet.driverEmails()[index]);
        UUID existing = jdbc.query("select driver_id from driver where user_account_id = ?",
                rs -> rs.next() ? (UUID) rs.getObject(1) : null, accountId);
        if (existing != null) return existing;
        UUID id = UUID.randomUUID();
        jdbc.update("insert into driver(driver_id, fleet_owner_id, user_account_id, city_id, verified_by_account_id, license_number, "
                        + "license_expiry_date, driver_status, latitude, longitude, commission_percent) values (?,?,?,?,?,?,?,?,?,?,?)",
                id, fleetOwnerId, accountId, cityId, verifiedBy, fleet.licenseNumbers()[index],
                Date.valueOf(LocalDate.parse(fleet.licenseExpiries()[index])), "ACTIVE",
                new BigDecimal(fleet.lat()).subtract(BigDecimal.valueOf(index + 1, 2)),
                new BigDecimal(fleet.lon()).add(BigDecimal.valueOf(2 * index + 1, 2)),
                new BigDecimal(fleet.commissions()[index]));
        return id;
    }

    /**
     * Driver 1 - mini truck 1, driver 2 - mini truck 2, driver 3 - the bike; the light truck (index 2) is free.
     * Driver 3 drove the light truck before moving to the bike, which is the ENDED row.
     */
    private void seedAssignments(UUID ownerAccount, Fleet fleet, List<UUID> vehicles, List<UUID> drivers) {
        if (exists(jdbc, "select count(*) from vehicle_assignment where driver_id = ?", drivers.get(0))) return;
        insertAssignment(vehicles.get(0), drivers.get(0), ownerAccount, "ACTIVE", at(52, 9, 0), null, "500.00", "MINI_TRUCK");
        insertAssignment(vehicles.get(1), drivers.get(1), ownerAccount, "ACTIVE", at(52, 9, 10), null, "400.00", "MINI_TRUCK");
        insertAssignment(vehicles.get(2), drivers.get(2), ownerAccount, "ENDED", at(52, 9, 20), at(45, 17, 30), "1500.00", "TRUCK");
        insertAssignment(vehicles.get(3), drivers.get(2), ownerAccount, "ACTIVE", at(44, 9, 0), null, "25.00", "BIKE");
    }

    private void insertAssignment(UUID vehicleId, UUID driverId, UUID assignedBy, String status, java.time.OffsetDateTime assignedAt,
                                  java.time.OffsetDateTime endedAt, String cargoKg, String requiredType) {
        jdbc.update("insert into vehicle_assignment(vehicle_assignment_id, vehicle_id, driver_id, assigned_by_account_id, "
                        + "assignment_status, assigned_at, ended_at, cargo_weight_kg, required_vehicle_type) values (?,?,?,?,?,?,?,?,?)",
                UUID.randomUUID(), vehicleId, driverId, assignedBy, status,
                ts(LocalDateTime.ofInstant(assignedAt.toInstant(), SeedSupport.IST)),
                endedAt == null ? null : ts(LocalDateTime.ofInstant(endedAt.toInstant(), SeedSupport.IST)),
                new BigDecimal(cargoKg), requiredType);
    }

    private void seedExpense(UUID fleetOwnerId, UUID ownerAccount, UUID approver, List<UUID> vehicles, List<UUID> drivers, Object[] e) {
        UUID vehicleId = vehicles.get((Integer) e[0]);
        UUID driverId = (Integer) e[1] < 0 ? null : drivers.get((Integer) e[1]);
        LocalDate date = SeedSupport.AS_OF.toLocalDate().minusDays((Integer) e[4]);
        if (exists(jdbc, "select count(*) from fleet_expense where vehicle_id = ? and expense_type = ? and expense_date = ?",
                vehicleId, e[2], Date.valueOf(date))) return;
        String status = (String) e[5];
        boolean decided = "APPROVED".equals(status) || "REJECTED".equals(status);
        byte[] proof = syntheticPdf(e[2] + " receipt Rs " + e[3]);
        jdbc.update("insert into fleet_expense(fleet_expense_id, fleet_owner_id, vehicle_id, driver_id, created_by_account_id, "
                        + "approved_by_account_id, attachment_uploaded_by_account_id, expense_type, amount, expense_date, "
                        + "approval_status, proof_file_content, proof_file_name, proof_content_type) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                UUID.randomUUID(), fleetOwnerId, vehicleId, driverId, ownerAccount, decided ? approver : null, ownerAccount,
                e[2], new BigDecimal((String) e[3]), Date.valueOf(date), status, proof,
                ((String) e[2]).toLowerCase().replace('_', '-') + "-receipt-" + date + ".pdf", "application/pdf");
    }
}
