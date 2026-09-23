package com.cbg.lbos.exception;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import feign.FeignException;

/**
 * Centralizes HTTP status mapping for the service/controller layer, which otherwise throws
 * plain RuntimeException/IllegalArgumentException/IllegalStateException with no status
 * mapping at all - every one of those used to fall through to Spring Boot's default error
 * handling as a bare 500, including S2 Feign failures, leaking stack traces/raw messages and
 * giving clients no way to distinguish "not found" from "conflict" from "bad request".
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(ResourceNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleNotFound(ResourceNotFoundException exception, WebRequest request) {
		return build(HttpStatus.NOT_FOUND, exception.getMessage(), request);
	}

	@ExceptionHandler(DuplicateResourceException.class)
	public ResponseEntity<Map<String, Object>> handleDuplicate(DuplicateResourceException exception, WebRequest request) {
		return build(HttpStatus.CONFLICT, exception.getMessage(), request);
	}

	@ExceptionHandler(ConflictException.class)
	public ResponseEntity<Map<String, Object>> handleConflict(ConflictException exception, WebRequest request) {
		return build(HttpStatus.CONFLICT, exception.getMessage(), request);
	}

	@ExceptionHandler(BadRequestException.class)
	public ResponseEntity<Map<String, Object>> handleBadRequest(BadRequestException exception, WebRequest request) {
		return build(HttpStatus.BAD_REQUEST, exception.getMessage(), request);
	}

	@ExceptionHandler(IllegalArgumentException.class)
	public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException exception, WebRequest request) {
		return build(HttpStatus.BAD_REQUEST, exception.getMessage(), request);
	}

	@ExceptionHandler(MethodArgumentTypeMismatchException.class)
	public ResponseEntity<Map<String, Object>> handleTypeMismatch(MethodArgumentTypeMismatchException exception, WebRequest request) {
		String parameter = exception.getName();
		String expected = exception.getRequiredType() != null ? exception.getRequiredType().getSimpleName() : "the expected type";
		return build(HttpStatus.BAD_REQUEST, "Invalid value for '" + parameter + "': expected " + expected, request);
	}

	@ExceptionHandler(HttpMessageNotReadableException.class)
	public ResponseEntity<Map<String, Object>> handleUnreadable(HttpMessageNotReadableException exception, WebRequest request) {
		return build(HttpStatus.BAD_REQUEST, "Malformed request body", request);
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException exception, WebRequest request) {
		Map<String, String> fieldErrors = new LinkedHashMap<>();
		exception.getBindingResult().getFieldErrors()
				.forEach(error -> fieldErrors.putIfAbsent(error.getField(), error.getDefaultMessage()));
		Map<String, Object> body = baseBody(HttpStatus.BAD_REQUEST, "Request validation failed", request);
		body.put("fieldErrors", fieldErrors);
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
	}

	/*
	 * DriverController/FleetExpenseController throw IllegalStateException when there is no
	 * authenticated principal (or it isn't a parseable account id) resolving who performed a
	 * status/approval change - that's a 401, not a 500.
	 */
	@ExceptionHandler(IllegalStateException.class)
	public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException exception, WebRequest request) {
		return build(HttpStatus.UNAUTHORIZED, exception.getMessage(), request);
	}

	/*
	 * S2PartnerClient (validateFleetOwner) can fail for reasons unrelated to this request's
	 * validity - S2 down/slow (5xx, timeout -> 503) vs S2 genuinely reporting the referenced
	 * fleetOwnerId doesn't exist (404 -> surfaced here as 400, since it means the request's
	 * own fleetOwnerId is invalid). Never forward the raw Feign/S2 response body to the client.
	 */
	@ExceptionHandler(FeignException.class)
	public ResponseEntity<Map<String, Object>> handleFeign(FeignException exception, WebRequest request) {
		if (exception.status() == 404) {
			return build(HttpStatus.BAD_REQUEST, "Referenced fleet owner was not found", request);
		}
		if (exception.status() >= 400 && exception.status() < 500) {
			return build(HttpStatus.BAD_REQUEST, "Fleet owner reference could not be validated", request);
		}
		return build(HttpStatus.SERVICE_UNAVAILABLE, "Fleet owner verification service is currently unavailable", request);
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<Map<String, Object>> handleOther(Exception exception, WebRequest request) {
		return build(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred", request);
	}

	private ResponseEntity<Map<String, Object>> build(HttpStatus status, String message, WebRequest request) {
		return ResponseEntity.status(status).body(baseBody(status, message, request));
	}

	private Map<String, Object> baseBody(HttpStatus status, String message, WebRequest request) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("timestamp", OffsetDateTime.now());
		body.put("status", status.value());
		body.put("error", status.getReasonPhrase());
		body.put("message", message);
		body.put("path", request.getDescription(false).replace("uri=", ""));
		return body;
	}
}
