package com.cbg.lbos.exception;

/**
 * Thrown when creating a resource that violates a uniqueness rule already enforced at the
 * repository/entity level (e.g. duplicate vehicle registrationNumber, duplicate driver
 * licenseNumber/userAccountId). Mapped to 409 by GlobalExceptionHandler.
 */
public class DuplicateResourceException extends RuntimeException {

	public DuplicateResourceException(String message) {
		super(message);
	}
}
