package com.cbg.lbos.exception;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.WebRequest;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    @ExceptionHandler(ResourceNotFoundException.class)
    ResponseEntity<ApiErrorResponse> notFound(ResourceNotFoundException exception, WebRequest request) { return build(HttpStatus.NOT_FOUND, exception.getMessage(), request, Map.of()); }
    @ExceptionHandler(DuplicateResourceException.class)
    ResponseEntity<ApiErrorResponse> duplicate(DuplicateResourceException exception, WebRequest request) { return build(HttpStatus.CONFLICT, exception.getMessage(), request, Map.of()); }
    @ExceptionHandler(ConflictException.class)
    ResponseEntity<ApiErrorResponse> conflict(ConflictException exception, WebRequest request) { return build(HttpStatus.CONFLICT, exception.getMessage(), request, Map.of()); }
    @ExceptionHandler(InvalidAssignmentException.class)
    ResponseEntity<ApiErrorResponse> invalid(InvalidAssignmentException exception, WebRequest request) { return build(HttpStatus.UNPROCESSABLE_ENTITY, exception.getMessage(), request, Map.of()); }
    @ExceptionHandler(ValidationException.class)
    ResponseEntity<ApiErrorResponse> validationException(ValidationException exception, WebRequest request) {
        return build(HttpStatus.BAD_REQUEST, exception.getMessage(), request, Map.of());
    }
    @ExceptionHandler(InvalidCredentialsException.class)
    ResponseEntity<ApiErrorResponse> invalidCredentials(InvalidCredentialsException exception, WebRequest request) {
        return build(HttpStatus.UNAUTHORIZED, exception.getMessage(), request, Map.of());
    }
    @ExceptionHandler(PasswordExpiredException.class)
    ResponseEntity<ApiErrorResponse> passwordExpired(PasswordExpiredException exception, WebRequest request) {
        return build(HttpStatus.LOCKED, exception.getMessage(), request, Map.of());
    }
    @ExceptionHandler(MissingAuthenticatedUserException.class)
    ResponseEntity<ApiErrorResponse> missingAuthenticatedUser(MissingAuthenticatedUserException exception, WebRequest request) {
        return build(HttpStatus.UNAUTHORIZED, exception.getMessage(), request, Map.of());
    }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiErrorResponse> validation(MethodArgumentNotValidException exception, WebRequest request) {
        Map<String, String> validationErrors = new LinkedHashMap<>();
        exception.getBindingResult().getFieldErrors().forEach(error -> validationErrors.putIfAbsent(error.getField(), error.getDefaultMessage()));
        return build(HttpStatus.BAD_REQUEST, "Request validation failed", request, validationErrors);
    }
    /**
     * Catch-all for anything not explicitly handled above (an NPE, an unexpected downstream
     * failure, etc.) - logged in full server-side, but never forwarded to the client: an
     * exception's own message can carry internal detail (a class name, a SQL fragment, a raw
     * downstream response) that is never safe to show a user.
     */
    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiErrorResponse> unexpected(Exception exception, WebRequest request) {
        log.error("Unhandled exception", exception);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong. Please try again later.", request, Map.of());
    }
    private ResponseEntity<ApiErrorResponse> build(HttpStatus status, String message, WebRequest request, Map<String, String> validationErrors) {
        String path = request.getDescription(false).replace("uri=", "");
        return ResponseEntity.status(status).body(new ApiErrorResponse(OffsetDateTime.now(), status.value(), status.getReasonPhrase(), message, path, validationErrors));
    }
}
