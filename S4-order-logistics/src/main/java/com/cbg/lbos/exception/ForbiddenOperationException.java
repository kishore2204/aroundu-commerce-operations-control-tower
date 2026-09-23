package com.cbg.lbos.exception;

/**
 * Raised when an authenticated caller is not permitted to act on a specific resource -
 * e.g. a RETAILER-role JWT accepting/rejecting an order none of whose line items belong
 * to them. Distinct from ResourceNotFoundException (the order exists, the caller just
 * doesn't own it) and from the generic IllegalArgumentException-driven 400s used for
 * invalid state transitions elsewhere in this service.
 */
public class ForbiddenOperationException extends RuntimeException {

    public ForbiddenOperationException(String message) {
        super(message);
    }
}
