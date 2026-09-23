package com.cbg.lbos.exception;

/**
 * Thrown when a request is well-formed and references real resources, but the current state
 * of those resources conflicts with the requested operation (vehicle/driver already has an
 * active assignment, expense already decided, driver license expired, status not eligible for
 * the transition, etc). Mapped to 409 by GlobalExceptionHandler.
 */
public class ConflictException extends RuntimeException {

	public ConflictException(String message) {
		super(message);
	}
}
