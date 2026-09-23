package com.cbg.lbos.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.OffsetDateTime;

/**
 * S4-local mirror of the response envelope used by S3 (lbos-commerce).
 * S3 wraps every payload as {timestamp, correlationId, message, data}.
 * Modelled locally on purpose - S4 never imports another service's classes.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ApiResponseEnvelope<T>(
        OffsetDateTime timestamp,
        String correlationId,
        String message,
        T data) {
}
