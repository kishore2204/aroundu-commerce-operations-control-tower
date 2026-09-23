package com.cbg.lbos.exception;

/**
 * Thrown when a Vehicle/Driver/VehicleAssignment/FleetExpense id referenced in a request
 * (path variable or DTO field) doesn't exist. Mapped to 404 by GlobalExceptionHandler.
 */
public class ResourceNotFoundException extends RuntimeException {

	public ResourceNotFoundException(String message) {
		super(message);
	}
}
