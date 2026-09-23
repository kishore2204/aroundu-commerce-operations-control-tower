package com.cbg.lbos.validation;

import java.util.regex.Pattern;

/**
 * The single password rule of the platform (registration, admin account creation, officer creation,
 * driver accounts, password reset): 8-72 characters with at least one uppercase letter, one lowercase
 * letter, one number and one special character (anything that is not a letter, digit or whitespace).
 * The Angular screens mirror it in core/validation/password-policy.ts, so both sides agree.
 */
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 8;
    public static final int MAX_LENGTH = 72;

    /** Compile-time constant so it can be used directly in {@code @Pattern}. */
    public static final String REGEX = "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[^A-Za-z\\d\\s]).{8,72}$";

    public static final String MESSAGE =
            "Password must be 8 to 72 characters and contain an uppercase letter, a lowercase letter, a number and a special character";

    private static final Pattern PATTERN = Pattern.compile(REGEX);

    private PasswordPolicy() {
    }

    public static boolean isValid(String password) {
        return password != null && PATTERN.matcher(password).matches();
    }
}
