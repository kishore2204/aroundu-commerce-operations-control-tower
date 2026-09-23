package com.cbg.lbos.validation;

import com.cbg.lbos.exception.BadRequestException;

/**
 * The rules for a driver's licence number and a vehicle's registration number. The Angular forms use the same patterns,
 * so a value the screen accepts is a value the server accepts (and the server is the one that decides). Both values are
 * stored upper-case without spaces or hyphens, which is also what the uniqueness checks compare.
 */
public final class FleetIdentifierRules {

    /**
     * Indian driving licence: 2 state letters, 2 digits, then 11 or 12 more digits (15 or 16 characters), e.g.
     * {@code TN1420110012345} or {@code KA05201200123456}. Deliberately not tied to one state's layout, so a valid licence
     * from another state is not rejected.
     */
    public static final String LICENCE_REGEX = "^[A-Z]{2}[0-9]{2}[0-9]{11,12}$";
    public static final String LICENCE_MESSAGE = "Enter a valid driving licence number.";
    public static final String LICENCE_REQUIRED_MESSAGE = "Driving licence number is required.";

    /**
     * Indian vehicle registration, three supported layouts: standard {@code MH12AB1234} / {@code KA05JK4471} (state, 2-digit
     * RTO, 1-2 series letters, 4 digits), single-letter series {@code DL3C1234}, and Bharat series {@code 22BH1234A} /
     * {@code 22BH1234AB}. The whole alternation is anchored as ONE group, so {@code ^} and {@code $} apply to every layout.
     */
    public static final String VEHICLE_REGEX =
            "^(?:[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}|[A-Z]{2}[0-9][A-Z][0-9]{4}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2})$";
    public static final String VEHICLE_MESSAGE = "Enter a valid vehicle registration number.";
    public static final String VEHICLE_REQUIRED_MESSAGE = "Vehicle registration number is required.";

    private FleetIdentifierRules() {
    }

    /** Upper-case with every space and hyphen removed; a blank value becomes {@code null}. */
    public static String normalize(String value) {
        if (value == null) return null;
        String cleaned = value.replaceAll("[\\s-]+", "").toUpperCase();
        return cleaned.isEmpty() ? null : cleaned;
    }

    /** The normalised licence number, or a {@link BadRequestException} (HTTP 400) carrying the message the user should see. */
    public static String requireValidLicence(String value) {
        String normalized = normalize(value);
        if (normalized == null) throw new BadRequestException(LICENCE_REQUIRED_MESSAGE);
        if (!normalized.matches(LICENCE_REGEX)) throw new BadRequestException(LICENCE_MESSAGE);
        return normalized;
    }

    /** The normalised registration number, or a {@link BadRequestException} carrying the message the user should see. */
    public static String requireValidVehicleNumber(String value) {
        String normalized = normalize(value);
        if (normalized == null) throw new BadRequestException(VEHICLE_REQUIRED_MESSAGE);
        if (!normalized.matches(VEHICLE_REGEX)) throw new BadRequestException(VEHICLE_MESSAGE);
        return normalized;
    }
}
