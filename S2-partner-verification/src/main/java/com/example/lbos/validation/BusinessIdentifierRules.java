package com.example.lbos.validation;

/**
 * The rules for the identifiers S2 accepts: a retailer's GSTIN and shop registration number, and the licence / vehicle
 * numbers of the drivers and vehicles a fleet owner adds. The Angular forms use the same patterns and S5 (which owns the
 * driver and vehicle records) checks them again, so a value the screen accepts is a value every server accepts.
 */
public final class BusinessIdentifierRules {

    /**
     * GSTIN, 15 characters: 2-digit state code, the 10-character PAN (5 letters, 4 digits, 1 letter), an entity number
     * (1-9 or A-Z), the letter Z, and a check character. Example: {@code 33ABCDE1234F1Z5}.
     */
    public static final String GSTIN_REGEX = "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$";
    public static final String GSTIN_MESSAGE = "Enter a valid 15-character GSTIN.";
    public static final String GSTIN_REQUIRED_MESSAGE = "GST number is required.";

    /**
     * Shop registration / Gumasta licence number: 8 to 25 upper-case letters, digits, slashes or hyphens. Registration
     * numbers differ a lot from state to state, so only the character set and the length are checked.
     */
    public static final String REGISTRATION_REGEX = "^[A-Z0-9/-]{8,25}$";
    public static final String REGISTRATION_MESSAGE = "Enter a valid shop registration number using 8 to 25 letters, numbers, /, or -.";
    public static final String REGISTRATION_REQUIRED_MESSAGE = "Shop registration number is required.";

    /** Driving licence: 2 state letters, 2 digits, then 11 or 12 more digits (same rule as S5). */
    public static final String LICENCE_REGEX = "^[A-Z]{2}[0-9]{2}[0-9]{11,12}$";
    public static final String LICENCE_MESSAGE = "Enter a valid driving licence number.";
    public static final String LICENCE_REQUIRED_MESSAGE = "Driving licence number is required.";

    /** Vehicle registration: standard {@code MH12AB1234}, single-letter series {@code DL3C1234}, Bharat series {@code 22BH1234A} (same rule as S5). */
    public static final String VEHICLE_REGEX =
            "^(?:[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}|[A-Z]{2}[0-9][A-Z][0-9]{4}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2})$";
    public static final String VEHICLE_MESSAGE = "Enter a valid vehicle registration number.";
    public static final String VEHICLE_REQUIRED_MESSAGE = "Vehicle registration number is required.";

    private BusinessIdentifierRules() {
    }

    /** A GSTIN is stored upper-case without spaces; a blank value becomes {@code null}. */
    public static String normalizeGstin(String value) {
        return stripped(value, "\\s+");
    }

    /** A registration number is stored upper-case without spaces; a blank value becomes {@code null}. */
    public static String normalizeRegistration(String value) {
        return stripped(value, "\\s+");
    }

    /** Licence and vehicle numbers are stored upper-case without spaces or hyphens. */
    public static String normalizeCompact(String value) {
        return stripped(value, "[\\s-]+");
    }

    private static String stripped(String value, String remove) {
        if (value == null) return null;
        String cleaned = value.replaceAll(remove, "").toUpperCase();
        return cleaned.isEmpty() ? null : cleaned;
    }

    public static boolean isValidGstin(String value) {
        return value != null && value.matches(GSTIN_REGEX);
    }

    public static boolean isValidRegistration(String value) {
        return value != null && value.matches(REGISTRATION_REGEX);
    }
}
