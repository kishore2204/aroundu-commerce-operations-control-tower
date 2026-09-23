package com.cbg.lbos.exception;

/**
 * Thrown for invalid request content that isn't a simple "not found" (e.g. mismatched fleet
 * owners between a vehicle and a driver, a fleetOwnerId that isn't active/verified in S2, an
 * expense with a non-positive amount or a future date). Mapped to 400 by
 * GlobalExceptionHandler.
 */
public class BadRequestException extends RuntimeException {

	public BadRequestException(String message) {
		super(message);
	}
}
