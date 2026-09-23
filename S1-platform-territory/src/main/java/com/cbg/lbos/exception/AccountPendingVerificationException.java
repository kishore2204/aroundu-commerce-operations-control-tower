package com.cbg.lbos.exception;

/**
 * Raised at login when the submitted credentials were correct but the account's underlying
 * partner record (driver, retailer, or fleet owner) has not been approved yet.
 *
 * <p>Deliberately distinct from {@link InvalidCredentialsException}: it is only ever raised
 * <em>after</em> the password has been verified, so it reveals nothing about which emails exist
 * that the caller did not already prove they own. Wrong password and unknown email both keep
 * the single generic "Invalid email or password" message.
 */
public class AccountPendingVerificationException extends RuntimeException {
    /**
     * Creates the exception.
     *
     * @param message the message shown to the user explaining that approval is still pending
     */
    public AccountPendingVerificationException(String message) {
        super(message);
    }
}
