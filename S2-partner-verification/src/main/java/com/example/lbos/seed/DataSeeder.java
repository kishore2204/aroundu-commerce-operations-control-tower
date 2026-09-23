package com.example.lbos.seed;

import static com.example.lbos.seed.SeedSupport.LOG;
import static com.example.lbos.seed.SeedSupport.at;
import static com.example.lbos.seed.SeedSupport.await;
import static com.example.lbos.seed.SeedSupport.exists;
import static com.example.lbos.seed.SeedSupport.runAsync;
import static com.example.lbos.seed.SeedSupport.syntheticPdf;
import static com.example.lbos.seed.SeedSupport.ts;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Time;
import java.time.LocalDate;
import java.time.LocalTime;
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
 * S2 - Partner Onboarding &amp; Verification: the retailers, the fleet owners and the verification trail of every
 * partner (see seed-data/RETAILERS.md, FLEET.md, VERIFICATION.md).
 *
 * <ul>
 *   <li>Retailers and fleet owners are what an approved onboarding leaves behind: status VERIFIED / ACTIVE.</li>
 *   <li>Each subject has its verification queue (APPROVED, reviewed by the Location Manager of its zone) and the
 *       documents the subject type requires (VerificationQueueServiceImpl.requiredDocumentTypes) - a retailer 4,
 *       a fleet owner 2, a driver 1 (DRIVING_LICENSE), a vehicle 1 (INSURANCE) - each with a real (synthetic) file.</li>
 *   <li>Driver and vehicle queues can only be written once S5 has created the drivers and vehicles, so they are
 *       seeded by a background thread that waits for them (S2 itself is up and serving meanwhile).</li>
 * </ul>
 * Accounts, cities, zones and managers are S1's rows, found by email / name - never by an invented id.
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

    /**
     * email, business name, city, zone, registration no., GSTIN, latitude, longitude, opens, closes, onboarded (days ago).
     * Every store is open ALL DAY (00:00 - 23:59:59): S3 lists only the products of stores that are open right now by the
     * real clock (S2 getOpenRetailerIds), and a zone has one or two stores, so realistic shop hours would make the whole
     * catalogue disappear at night. Change a store's hours on its profile to try the "closed store" behaviour.
     */
    private static final Object[][] RETAILERS = {
            {"retailer1.chn@lbos.com", "Chennai Fresh Basket", "Chennai", "North", "UDYAM-TN-02-0041867", "33AAHFC4521M1ZP",
                    "13.1114", "80.2472", "00:00", "23:59:59", 74},
            {"retailer2.baw@lbos.com", "Bengaluru Daily Mart", "Bengaluru", "West", "UDYAM-KA-03-0058213", "29AAKFB7310P1ZT",
                    "12.9915", "77.5541", "00:00", "23:59:59", 73},
            {"retailer3.hye@lbos.com", "Hyderabad Harvest Store", "Hyderabad", "East", "UDYAM-TS-02-0033490", "36AAJFH2764K1ZQ",
                    "17.4062", "78.5591", "00:00", "23:59:59", 72},
            {"retailer4.chs@lbos.com", "Southern Spice Market", "Chennai", "South", "UDYAM-TN-02-0052716", "33AAKFS9184D1ZL",
                    "12.9812", "80.2409", "00:00", "23:59:59", 69},
            {"retailer5.chn@lbos.com", "Perambur Daily Needs", "Chennai", "North", "UDYAM-TN-02-0060342", "33AAJFP6653G1ZW",
                    "13.1180", "80.2440", "00:00", "23:59:59", 67},
    };

    /** email, business name, city, zone, onboarded (days ago) */
    private static final Object[][] FLEET_OWNERS = {
            {"fleet1.baw@lbos.com", "Bengaluru Route Logistics", "Bengaluru", "West", 71},
            {"fleet2.hye@lbos.com", "Deccan Fleet Services", "Hyderabad", "East", 70},
            {"fleet3.chn@lbos.com", "Chennai City Carriers", "Chennai", "North", 70},
    };

    /** the Location Manager who reviews a zone's applications */
    private static final Map<String, String> ZONE_REVIEWER = Map.of(
            "Chennai/North", "lm1.chn@lbos.com", "Chennai/South", "lm2.chn@lbos.com",
            "Bengaluru/West", "lm1.baw@lbos.com", "Hyderabad/East", "lm1.hye@lbos.com");
    private static final Map<String, String> CITY_OPERATIONS_MANAGER = Map.of(
            "Chennai", "op.ch@lbos.com", "Bengaluru", "op.ba@lbos.com", "Hyderabad", "op.hy@lbos.com");

    private static final String[] RETAILER_DOCUMENTS = {"GST_CERTIFICATE", "PAN_CARD", "BUSINESS_LICENSE", "ADDRESS_PROOF"};
    private static final String[] FLEET_OWNER_DOCUMENTS = {"GST_NUMBER", "PAN_CARD"};

    /** The seeding runs on a background thread, so S2 starts (and its tests load) without waiting for the other services. */
    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            LOG.info("S2 seed skipped (app.seed.enabled=false)");
            return;
        }
        runAsync("seed-s2", this::seedAll);
    }

    private void seedAll() {
        for (Object[] r : RETAILERS) seedRetailer(r);
        for (Object[] f : FLEET_OWNERS) seedFleetOwner(f);
        LOG.info("S2 seed: {} retailers, {} fleet owners; driver / vehicle verification follows once S5 has its rows",
                RETAILERS.length, FLEET_OWNERS.length);
        seedDriverAndVehicleVerification();
    }

    // ---- lookups (S1 / S5 rows by business key) --------------------------------------------------------------

    private UUID account(String email) {
        return await(jdbc, "account " + email, UUID.class, "select user_account_id from user_account where email = ?", email);
    }

    private UUID city(String name) {
        return await(jdbc, "city " + name, UUID.class, "select city_id from city where city_name = ?", name);
    }

    private UUID zone(String city, String zone) {
        return await(jdbc, "zone " + city + "/" + zone, UUID.class,
                "select z.zone_id from zone z join city c on c.city_id = z.city_id where c.city_name = ? and z.zone_name = ?", city, zone);
    }

    private UUID operationsManager(String city) {
        return await(jdbc, "operations manager of " + city, UUID.class,
                "select om.operations_manager_id from operations_manager om join user_account u on u.user_account_id = om.user_account_id "
                        + "where u.email = ?", CITY_OPERATIONS_MANAGER.get(city));
    }

    private UUID reviewer(String city, String zone) {
        return account(ZONE_REVIEWER.get(city + "/" + zone));
    }

    // ---- retailers ---------------------------------------------------------------------------------------------

    private void seedRetailer(Object[] r) {
        UUID accountId = account((String) r[0]);
        UUID retailerId = jdbc.query("select retailer_id from retailer where user_account_id = ?",
                rs -> rs.next() ? (UUID) rs.getObject(1) : null, accountId);
        if (retailerId == null) {
            retailerId = UUID.randomUUID();
            jdbc.update("insert into retailer(retailer_id, user_account_id, operations_manager_id, city_id, zone_id, longitude, "
                            + "latitude, business_name, registration_number, gst_number, retailer_status, is_open, opens_at, closes_at) "
                            + "values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    retailerId, accountId, operationsManager((String) r[2]), city((String) r[2]), zone((String) r[2], (String) r[3]),
                    new BigDecimal((String) r[7]), new BigDecimal((String) r[6]), r[1], r[4], r[5], "VERIFIED", true,
                    Time.valueOf(LocalTime.parse((String) r[8])), Time.valueOf(LocalTime.parse((String) r[9])));
        }
        int onboarded = (Integer) r[10];
        UUID reviewer = reviewer((String) r[2], (String) r[3]);
        UUID zoneId = zone((String) r[2], (String) r[3]);
        UUID queueId = seedQueue("RETAILER", retailerId, zoneId, accountId, reviewer, at(onboarded, 12, 0), at(onboarded - 3, 15, 30));
        boolean resubmitted = "retailer4.chs@lbos.com".equals(r[0]);
        for (String type : RETAILER_DOCUMENTS) {
            LocalDate expiry = "BUSINESS_LICENSE".equals(type) ? LocalDate.of(2028, 3, 31) : null;
            if (resubmitted && "BUSINESS_LICENSE".equals(type)) {
                // first upload rejected (unreadable copy), second upload approved - the full document history
                seedDocument(queueId, type, 1, false, "REJECTED", accountId, reviewer, (String) r[1], expiry,
                        "The licence copy is cropped - the expiry date cannot be read. Please upload the full page.",
                        at(onboarded - 1, 14, 0), at(onboarded - 1, 17, 45),
                        "Rejected - full page required");
                seedDocument(queueId, type, 2, true, "APPROVED", accountId, reviewer, (String) r[1], expiry, null,
                        at(onboarded - 2, 11, 10), at(onboarded - 3, 15, 30), "Verified against the original licence");
            } else {
                seedDocument(queueId, type, 1, true, "APPROVED", accountId, reviewer, (String) r[1], expiry, null,
                        at(onboarded, 12, 5), at(onboarded - 3, 15, 30), "Verified against the original document");
            }
        }
    }

    // ---- fleet owners ------------------------------------------------------------------------------------------

    private void seedFleetOwner(Object[] f) {
        UUID accountId = account((String) f[0]);
        UUID fleetOwnerId = jdbc.query("select fleet_owner_id from fleet_owner where user_account_id = ?",
                rs -> rs.next() ? (UUID) rs.getObject(1) : null, accountId);
        UUID zoneId = zone((String) f[2], (String) f[3]);
        UUID operationsManager = operationsManager((String) f[2]);
        UUID operationsManagerAccount = account(CITY_OPERATIONS_MANAGER.get((String) f[2]));
        if (fleetOwnerId == null) {
            fleetOwnerId = UUID.randomUUID();
            jdbc.update("insert into fleet_owner(fleet_owner_id, user_account_id, operations_manager_id, city_id, zone_id, business_name, "
                            + "bank_verified_by_account_id, profile_status, owner_status) values (?,?,?,?,?,?,?,?,?)",
                    fleetOwnerId, accountId, operationsManager, city((String) f[2]), zoneId, f[1], operationsManagerAccount,
                    "VERIFIED", "ACTIVE");
        }
        int onboarded = (Integer) f[4];
        UUID reviewer = reviewer((String) f[2], (String) f[3]);
        UUID queueId = seedQueue("FLEET_OWNER", fleetOwnerId, zoneId, accountId, reviewer, at(onboarded, 12, 30), at(onboarded - 3, 16, 0));
        for (String type : FLEET_OWNER_DOCUMENTS) {
            seedDocument(queueId, type, 1, true, "APPROVED", accountId, reviewer, (String) f[1], null, null,
                    at(onboarded, 12, 35), at(onboarded - 3, 16, 0), "Verified against the original document");
        }
    }

    // ---- drivers and vehicles (waits for S5) -----------------------------------------------------------------

    private void seedDriverAndVehicleVerification() {
        try {
            for (Object[] f : FLEET_OWNERS) {
                UUID fleetOwnerAccount = account((String) f[0]);
                UUID fleetOwnerId = await(jdbc, "fleet owner " + f[1], UUID.class,
                        "select fleet_owner_id from fleet_owner where user_account_id = ?", fleetOwnerAccount);
                UUID zoneId = zone((String) f[2], (String) f[3]);
                UUID reviewer = reviewer((String) f[2], (String) f[3]);
                int onboarded = (Integer) f[4];

                // S5 creates the drivers / vehicles of this fleet owner: wait until all 3 drivers and 4 vehicles exist
                await(jdbc, "the 3 drivers of " + f[1], Integer.class,
                        "select case when count(*) >= 3 then 1 end from driver where fleet_owner_id = ?", fleetOwnerId);
                await(jdbc, "the 4 vehicles of " + f[1], Integer.class,
                        "select case when count(*) >= 4 then 1 end from vehicle where fleet_owner_id = ?", fleetOwnerId);

                List<Map<String, Object>> drivers = jdbc.queryForList(
                        "select driver_id, license_expiry_date, license_number from driver where fleet_owner_id = ? order by license_number", fleetOwnerId);
                int n = 0;
                for (Map<String, Object> d : drivers) {
                    UUID driverId = (UUID) d.get("driver_id");
                    LocalDate licenseExpiry = toLocalDate(d.get("license_expiry_date"));
                    UUID queueId = seedQueue("DRIVER", driverId, zoneId, fleetOwnerAccount, reviewer,
                            at(onboarded - 12 - n, 11, 0), at(onboarded - 14 - n, 14, 20));
                    {
                        seedDocument(queueId, "DRIVING_LICENSE", 1, true, "APPROVED", fleetOwnerAccount, reviewer,
                                "Driving licence " + d.get("license_number"), licenseExpiry, null,
                                at(onboarded - 12 - n, 11, 5), at(onboarded - 14 - n, 14, 20), "Licence verified with the issuing RTO record");
                    }
                    n++;
                }
                List<Map<String, Object>> vehicles = jdbc.queryForList(
                        "select vehicle_id, registration_number from vehicle where fleet_owner_id = ? order by registration_number", fleetOwnerId);
                n = 0;
                for (Map<String, Object> v : vehicles) {
                    UUID vehicleId = (UUID) v.get("vehicle_id");
                    UUID queueId = seedQueue("VEHICLE", vehicleId, zoneId, fleetOwnerAccount, reviewer,
                            at(onboarded - 10 - n, 10, 30), at(onboarded - 12 - n, 13, 10));
                    {
                        seedDocument(queueId, "INSURANCE", 1, true, "APPROVED", fleetOwnerAccount, reviewer,
                                "Insurance policy " + v.get("registration_number"), LocalDate.of(2027, 2 + n, 28), null,
                                at(onboarded - 10 - n, 10, 35), at(onboarded - 12 - n, 13, 10), "Insurance policy is valid");
                    }
                    n++;
                }
            }
            LOG.info("S2 seed: driver and vehicle verification queues written");
        } catch (RuntimeException failure) {
            LOG.error("S2 seed: driver / vehicle verification not written - {}", failure.getMessage());
        }
    }

    private static LocalDate toLocalDate(Object value) {
        if (value instanceof LocalDate date) return date;
        if (value instanceof Date date) return date.toLocalDate();
        return LocalDate.parse(String.valueOf(value));
    }

    // ---- verification queue / documents ----------------------------------------------------------------------

    /** The (approved, closed) queue of a subject - created when missing, so a half-finished earlier run is completed. */
    private UUID seedQueue(String subjectType, UUID subjectId, UUID zoneId, UUID submittedBy, UUID reviewedBy,
                           OffsetDateTime created, OffsetDateTime decided) {
        UUID existing = jdbc.query("select verification_queue_id from verification_queue where subject_type = ? and subject_id = ?",
                rs -> rs.next() ? (UUID) rs.getObject(1) : null, subjectType, subjectId);
        if (existing != null) return existing;
        UUID id = UUID.randomUUID();
        jdbc.update("insert into verification_queue(verification_queue_id, subject_type, subject_id, zone_id, is_active, "
                        + "submitted_by_account_id, reviewed_by_account_id, verification_status, rejection_reason, "
                        + "suspension_reason, deletion_reason, created_at, updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                id, subjectType, subjectId, zoneId, false, submittedBy, reviewedBy, "APPROVED", null, null, null,
                ts(created), ts(decided));
        return id;
    }

    private void seedDocument(UUID queueId, String type, int version, boolean current, String status, UUID uploadedBy,
                              UUID reviewedBy, String owner, LocalDate expiry, String rejectReason,
                              OffsetDateTime uploaded, OffsetDateTime reviewed, String comment) {
        if (exists(jdbc, "select count(*) from verification_document where verification_queue_id = ? and document_type_name = ? and version_number = ?",
                queueId, type, version)) return;
        byte[] content = syntheticPdf(type.replace('_', ' ') + " - " + owner);
        String fileName = type.toLowerCase().replace('_', '-') + "-v" + version + ".pdf";
        jdbc.update("insert into verification_document(document_id, verification_queue_id, document_type_name, version_number, "
                        + "file_content, file_name, content_type, file_size_bytes, expiry_date, document_status, reject_reason, "
                        + "is_current_version, uploaded_by_account_id, reviewed_by_account_id, reviewed_at, reviewer_comment, "
                        + "created_at, updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                UUID.randomUUID(), queueId, type, version, content, fileName, "application/pdf", (long) content.length,
                expiry == null ? null : Date.valueOf(expiry), status, rejectReason, current, uploadedBy, reviewedBy,
                ts(reviewed), comment, ts(uploaded), ts(reviewed));
    }
}
