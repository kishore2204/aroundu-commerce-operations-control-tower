package com.cbg.lbos.validation;

/**
 * The single e-mail rule of the platform (the Angular forms use the same pattern): a local part of letters, digits and
 * {@code . _ % + -} that starts and ends with a letter or digit and has no two dots in a row, an {@code @}, and a domain
 * of dot-separated labels ending in a top-level domain of at least two letters. So {@code user@example.com},
 * {@code first.last@example.co.in} and {@code user+tag@example.com} are valid, while {@code user}, {@code user@},
 * {@code @example.com}, {@code user@example} and {@code user @example.com} are not.
 */
public final class EmailRule {

    public static final int MAX_LENGTH = 160;
    public static final String REGEX =
            "^(?!.*\\.\\.)[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\\.)+[A-Za-z]{2,}$";
    public static final String REQUIRED_MESSAGE = "Email is required.";
    public static final String MESSAGE = "Enter a valid email address.";
    public static final String TOO_LONG_MESSAGE = "Email must not exceed 160 characters.";
    public static final String DUPLICATE_MESSAGE = "An account already exists with this email address.";

    private EmailRule() {
    }

    /** Leading and trailing whitespace is never part of an address; a blank value becomes {@code null}. */
    public static String normalize(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public static boolean isValid(String value) {
        return value != null && value.length() <= MAX_LENGTH && value.matches(REGEX);
    }
}
