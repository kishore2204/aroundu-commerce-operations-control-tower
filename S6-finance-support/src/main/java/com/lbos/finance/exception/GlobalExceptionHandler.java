package com.lbos.finance.exception;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import feign.FeignException;

/**
 * Every /api/** response in this service - success or failure - is JSON, never a servlet
 * container's default HTML error page or a raw stack trace. Handlers are ordered from the
 * most specific business exception down to a last-resort catch-all so nothing falls through
 * to Spring Boot's default error handling (which, unhandled, would leak exception class
 * names/messages to the client on a 500).
 *
 * Status mapping:
 *  - ResourceNotFoundException -> 404 (missing row, e.g. no payment transaction with that id)
 *  - BusinessRuleException -> 409 (every current use of this exception is a request that
 *    conflicts with the current state of a resource - an already-processed transaction,
 *    an over-limit refund/settlement amount, a duplicate settlement, a payment method
 *    mismatch, etc. - so CONFLICT is the accurate status, not 422/400)
 *  - ForbiddenActionException -> 403 (authenticated but not entitled to this specific
 *    resource, e.g. reading/replying to someone else's support ticket)
 *  - MethodArgumentNotValidException / MethodArgumentTypeMismatchException -> 400
 *    (bean-validation failures on @Valid request bodies, or a malformed path variable)
 *  - FeignException -> passes through the upstream service's own 4xx (S1/S3/S4 rejecting the
 *    request on its own terms, e.g. a 404 for an unknown order), and maps everything else
 *    (connection refused, timeout, 5xx) to 503 - documented gap from
 *    docs/feign-dependencies.md ("No handler for Feign/timeout failures in S6's
 *    GlobalExceptionHandler - falls through to generic 500") - fixed here.
 *  - Anything else -> 500 with a generic message; the real exception is logged server-side,
 *    never included in the response body.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ResourceNotFoundException.class)
    ResponseEntity<Map<String, Object>> notFound(ResourceNotFoundException exception) {
        return response(HttpStatus.NOT_FOUND, exception.getMessage());
    }

    @ExceptionHandler(BusinessRuleException.class)
    ResponseEntity<Map<String, Object>> business(BusinessRuleException exception) {
        return response(HttpStatus.CONFLICT, exception.getMessage());
    }

    @ExceptionHandler(ForbiddenActionException.class)
    ResponseEntity<Map<String, Object>> forbidden(ForbiddenActionException exception) {
        return response(HttpStatus.FORBIDDEN, exception.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, Object>> validation(MethodArgumentNotValidException exception) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", OffsetDateTime.now());
        body.put("status", HttpStatus.BAD_REQUEST.value());
        body.put("message", "Validation failed");
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        exception.getBindingResult().getFieldErrors()
                .forEach(fieldError -> fieldErrors.put(fieldError.getField(),
                        fieldError.getDefaultMessage()));
        body.put("errors", fieldErrors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<Map<String, Object>> malformedBody(HttpMessageNotReadableException exception) {
        return response(HttpStatus.BAD_REQUEST, "Malformed or missing request body");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<Map<String, Object>> noRoute(NoResourceFoundException exception) {
        return response(HttpStatus.NOT_FOUND, "No such endpoint");
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<Map<String, Object>> typeMismatch(MethodArgumentTypeMismatchException exception) {
        return response(HttpStatus.BAD_REQUEST,
                "Invalid value for parameter '" + exception.getName() + "'");
    }

    @ExceptionHandler(FeignException.class)
    ResponseEntity<Map<String, Object>> feign(FeignException exception) {
        int status = exception.status();
        if (status == 404) {
            log.warn("Upstream service returned 404: {}", exception.getMessage());
            return response(HttpStatus.NOT_FOUND, "A dependent resource in another service was not found");
        }
        if (status >= 400 && status < 500) {
            log.warn("Upstream service rejected the request ({}): {}", status, exception.getMessage());
            return response(HttpStatus.BAD_REQUEST, "The request was rejected by a dependent service");
        }
        log.error("Upstream service call failed", exception);
        return response(HttpStatus.SERVICE_UNAVAILABLE, "A dependent service is currently unavailable");
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, Object>> fallback(Exception exception) {
        log.error("Unhandled exception", exception);
        return response(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred");
    }

    private ResponseEntity<Map<String, Object>> response(HttpStatus status, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", OffsetDateTime.now());
        body.put("status", status.value());
        body.put("message", message);
        return ResponseEntity.status(status).body(body);
    }
}
