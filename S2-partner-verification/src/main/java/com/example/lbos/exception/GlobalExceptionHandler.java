package com.example.lbos.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(RetailerNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleRetailerNotFoundException(RetailerNotFoundException ex) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", ex.getMessage());
        response.put("status", HttpStatus.NOT_FOUND.value());
        return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(VerificationQueueNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleVerificationQueueNotFoundException(VerificationQueueNotFoundException ex) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", ex.getMessage());
        response.put("status", HttpStatus.NOT_FOUND.value());
        return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(VerificationDocumentNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleVerificationDocumentNotFoundException(VerificationDocumentNotFoundException ex) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", ex.getMessage());
        response.put("status", HttpStatus.NOT_FOUND.value());
        return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
    }



    @ExceptionHandler(FleetOwnerNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleFleetOwnerNotFoundException(FleetOwnerNotFoundException ex) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", ex.getMessage());
        response.put("status", HttpStatus.NOT_FOUND.value());
        return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(ForbiddenActionException.class)
    public ResponseEntity<Map<String, Object>> handleForbiddenActionException(ForbiddenActionException ex) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", ex.getMessage());
        response.put("status", HttpStatus.FORBIDDEN.value());
        return new ResponseEntity<>(response, HttpStatus.FORBIDDEN);
    }

    /** A request that names an invalid value (e.g. an impossible date range) is the caller's mistake, not a server failure. */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgumentException(IllegalArgumentException ex) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", ex.getMessage());
        response.put("status", HttpStatus.BAD_REQUEST.value());
        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(InvalidVerificationTransitionException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidVerificationTransitionException(InvalidVerificationTransitionException ex) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", ex.getMessage());
        response.put("status", HttpStatus.CONFLICT.value());
        return new ResponseEntity<>(response, HttpStatus.CONFLICT);
    }

    @ExceptionHandler(MissingAuthenticatedUserException.class)
    public ResponseEntity<Map<String, Object>> handleMissingAuthenticatedUserException(MissingAuthenticatedUserException ex) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", ex.getMessage());
        response.put("status", HttpStatus.UNAUTHORIZED.value());
        return new ResponseEntity<>(response, HttpStatus.UNAUTHORIZED);
    }

    @ExceptionHandler(InvalidDocumentFileException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidDocumentFileException(InvalidDocumentFileException ex) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", ex.getMessage());
        response.put("status", HttpStatus.BAD_REQUEST.value());
        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUploadSizeExceededException(MaxUploadSizeExceededException ex) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Uploaded file exceeds the maximum allowed request/file size");
        response.put("status", HttpStatus.BAD_REQUEST.value());
        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<Map<String, Object>> handleMissingServletRequestPartException(MissingServletRequestPartException ex) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", ex.getMessage());
        response.put("status", HttpStatus.BAD_REQUEST.value());
        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleMethodArgumentNotValidException(MethodArgumentNotValidException ex) {
        Map<String, Object> response = new HashMap<>();
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(fieldError ->
                fieldErrors.put(fieldError.getField(), fieldError.getDefaultMessage()));
        response.put("message", "Validation failed");
        response.put("errors", fieldErrors);
        response.put("status", HttpStatus.BAD_REQUEST.value());
        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
    }

    /**
     * Catches persistence-layer failures (constraint violations, optimistic-lock failures,
     * etc.) so raw SQL/JDBC exception messages never reach the client. Deliberately scoped to
     * DataAccessException rather than a blanket Exception.class handler - a blanket handler
     * here would also swallow framework-level exceptions that already carry the correct
     * status (e.g. NoResourceFoundException's 404, HttpRequestMethodNotSupportedException's
     * 405), turning them into incorrect 500s.
     */
    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, Object>> handleDataAccessException(DataAccessException ex) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", "A data access error occurred");
        response.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
        return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    /**
     * Catch-all for anything not already handled above - an NPE, an unchecked RuntimeException,
     * or any other unexpected failure. Deliberately checks {@link ErrorResponse} first: Spring's
     * own self-describing HTTP exceptions (e.g. a 404 for an unmapped route, a 405 for a
     * disallowed method) already carry the correct status and a safe message, so those pass
     * through with their own status untouched instead of being collapsed into an incorrect 500 -
     * this preserves the reasoning already documented on {@link #handleDataAccessException} for
     * not using a blanket handler. Anything else is logged in full server-side and never
     * forwarded to the client, since an arbitrary exception's own message can carry internal
     * detail (a class name, a SQL fragment, a raw downstream response).
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception ex) {
        if (ex instanceof ErrorResponse errorResponse) {
            HttpStatusCode status = errorResponse.getStatusCode();
            Map<String, Object> response = new HashMap<>();
            String detail = errorResponse.getBody().getDetail();
            response.put("message", detail != null && !detail.isBlank() ? detail : errorResponse.getBody().getTitle());
            response.put("status", status.value());
            return new ResponseEntity<>(response, status);
        }
        log.error("Unhandled exception", ex);
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Something went wrong. Please try again later.");
        response.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
        return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
