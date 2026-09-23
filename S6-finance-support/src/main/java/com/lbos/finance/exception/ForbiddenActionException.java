package com.lbos.finance.exception;

/** The caller is authenticated but not entitled to act on this specific resource (e.g. reading
 *  or replying to someone else's support ticket). Mapped to 403 by GlobalExceptionHandler. */
public class ForbiddenActionException extends RuntimeException {
    public ForbiddenActionException(String message) {
        super(message);
    }
}
