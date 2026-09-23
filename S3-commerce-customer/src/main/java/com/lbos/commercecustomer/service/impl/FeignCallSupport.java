package com.lbos.commercecustomer.service.impl;

import java.net.SocketTimeoutException;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;

import org.springframework.stereotype.Component;

import com.lbos.commercecustomer.exception.ExternalServiceTimeoutException;
import com.lbos.commercecustomer.exception.ExternalServiceUnavailableException;

import feign.RetryableException;

/**
 * Every S3 Feign call to another service (S1 territory validation, S2 retailer lookup, S4
 * serviceability/review-eligibility, S6 tax calculation) previously let a downstream failure
 * fall straight through to GlobalExceptionHandler's generic Exception handler - a clean JSON
 * envelope (no stack trace leaked to the client) but always a 500, even though
 * ExternalServiceUnavailableException (503) / ExternalServiceTimeoutException (504) already
 * exist in the exception hierarchy and are wired into the handler. Nothing threw them.
 * Documented as a known gap in docs/feign-dependencies.md; this wraps every such call site so
 * a downstream-unreachable failure surfaces as 503 and a downstream timeout as 504, instead of
 * a generic 500.
 *
 * Deliberately catches broadly: Eureka/load-balancer "no instance available" failures surface
 * as a plain IllegalStateException (no dedicated exception type from spring-cloud-loadbalancer
 * for this case), and a refused/reset connection surfaces as a plain RuntimeException wrapping
 * java.net.ConnectException - neither is a feign.FeignException subtype.
 */
@Component
public class FeignCallSupport {

    public <T> T call(String serviceName, Supplier<T> invocation) {
        try {
            return invocation.get();
        } catch (RetryableException timeout) {
            throw new ExternalServiceTimeoutException(serviceName + " timed out", timeout);
        } catch (RuntimeException failure) {
            if (isTimeout(failure)) {
                throw new ExternalServiceTimeoutException(serviceName + " timed out", failure);
            }
            throw new ExternalServiceUnavailableException(serviceName + " is unavailable", failure);
        }
    }

    private boolean isTimeout(Throwable failure) {
        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            if (cause instanceof SocketTimeoutException || cause instanceof TimeoutException) {
                return true;
            }
            if (cause.getCause() == cause) {
                break;
            }
        }
        return false;
    }
}
