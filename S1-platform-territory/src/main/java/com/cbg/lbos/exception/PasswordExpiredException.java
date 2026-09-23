package com.cbg.lbos.exception;

/** Raised at login when the account's password is past the 90-day age policy. */
public class PasswordExpiredException extends RuntimeException {
    public PasswordExpiredException(String message) {
        super(message);
    }
}
