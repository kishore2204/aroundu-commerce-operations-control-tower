package com.lbos.finance.seed;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Shared helpers of the development seed data (one identical copy lives in every service's seed package - the
 * services share no code). See seed-data/README.md for the design of the seed.
 *
 * <ul>
 *   <li>Every service owns its own seeder; all six run against ONE database, so a seeder finds the rows of the
 *       services it depends on by their business keys (email, business name, SKU, order number ...) with
 *       {@link #await} - no id is ever invented or shared between services, and the start order of the
 *       services does not matter.</li>
 *   <li>Every record carries dates relative to {@link #AS_OF}, the fixed "as of" moment of the dataset, so the
 *       history is chronological and reproducible.</li>
 * </ul>
 */
final class SeedSupport {

    static final Logger LOG = LoggerFactory.getLogger("seed");

    /** The single development password of every seeded account (see seed-data/credentials.md). */
    static final String PASSWORD = "Lbos@2026!";

    static final ZoneOffset IST = ZoneOffset.ofHoursMinutes(5, 30);

    /** "Now" of the dataset: every seeded moment is at or before this instant. */
    static final OffsetDateTime AS_OF = OffsetDateTime.of(2026, 9, 20, 18, 0, 0, 0, IST);

    private static final long WAIT_SECONDS = 420;
    private static final long POLL_MILLIS = 3000;

    private SeedSupport() {
    }

    /**
     * The gateway reference of an order's payment. The same rule is used by S4 (Order.transactionReference) and
     * S6 (PaymentTransaction.providerReference), so the two services agree on it without sharing anything.
     */
    static String paymentReference(String orderNumber) {
        return "TXN" + String.format("%010d", Math.abs((long) orderNumber.hashCode()));
    }

    /**
     * Runs a seeder's work on a daemon thread: the service starts (and its tests load) without waiting for the other
     * services, and a seeding failure is logged instead of failing the service.
     */
    static void runAsync(String name, Runnable task) {
        Thread thread = new Thread(() -> {
            try {
                task.run();
            } catch (RuntimeException failure) {
                LOG.error("{} failed: {}", name, failure.getMessage(), failure);
            }
        }, name);
        thread.setDaemon(true);
        thread.start();
    }

    /** A moment {@code daysAgo} days (and the given clock time) before {@link #AS_OF}'s date, in IST. */
    static OffsetDateTime at(int daysAgo, int hour, int minute) {
        LocalDate date = AS_OF.toLocalDate().minusDays(daysAgo);
        return OffsetDateTime.of(date.getYear(), date.getMonthValue(), date.getDayOfMonth(), hour, minute, 0, 0, IST);
    }

    static Timestamp ts(OffsetDateTime value) {
        return value == null ? null : Timestamp.from(value.toInstant());
    }

    static Timestamp ts(LocalDateTime value) {
        return value == null ? null : Timestamp.valueOf(value);
    }

    static BigDecimal money(String value) {
        return new BigDecimal(value);
    }

    /**
     * Waits until the query returns a row (another service may not have seeded it yet) and returns its first
     * column. Gives up after a few minutes with a clear message instead of seeding dangling references.
     */
    static <T> T await(JdbcTemplate jdbc, String what, Class<T> type, String sql, Object... args) {
        long deadline = System.currentTimeMillis() + WAIT_SECONDS * 1000;
        while (true) {
            try {
                List<T> rows = jdbc.queryForList(sql, type, args);
                if (!rows.isEmpty() && rows.get(0) != null) return rows.get(0);
            } catch (RuntimeException notReady) {
                // the other service's table may not exist yet - keep waiting
            }
            if (System.currentTimeMillis() > deadline) {
                throw new IllegalStateException("Seed dependency not found after " + WAIT_SECONDS + "s: " + what);
            }
            try {
                Thread.sleep(POLL_MILLIS);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted while waiting for " + what, interrupted);
            }
        }
    }

    static boolean exists(JdbcTemplate jdbc, String sql, Object... args) {
        Integer count = jdbc.queryForObject(sql, Integer.class, args);
        return count != null && count > 0;
    }

    /** A tiny, structurally valid one-page PDF that only states it is synthetic development data. */
    static byte[] syntheticPdf(String title) {
        String safe = title.replaceAll("[^A-Za-z0-9 .,&()/-]", " ");
        String content = "BT /F1 14 Tf 60 740 Td (" + safe + ") Tj 0 -24 Td (Synthetic document - AroundU development data) Tj ET";
        String pdf = "%PDF-1.4\n"
                + "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
                + "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
                + "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
                + "4 0 obj<</Length " + content.length() + ">>stream\n" + content + "\nendstream endobj\n"
                + "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"
                + "trailer<</Root 1 0 R/Size 6>>\n%%EOF\n";
        return pdf.getBytes(StandardCharsets.US_ASCII);
    }
}
