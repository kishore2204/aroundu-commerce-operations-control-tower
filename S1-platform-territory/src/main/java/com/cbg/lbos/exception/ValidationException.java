package com.cbg.lbos.exception;

/** Raised when a request violates service-level validation rules. */
public class ValidationException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public ValidationException(String message) {
        super(message);
    }
}
