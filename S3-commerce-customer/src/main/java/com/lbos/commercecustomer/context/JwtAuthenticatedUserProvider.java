package com.lbos.commercecustomer.context;

import java.util.UUID;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import com.lbos.commercecustomer.exception.InvalidAuthenticatedUserException;
import com.lbos.commercecustomer.exception.MissingAuthenticatedUserException;

/**
 * Resolves "the current user" from the JWT subject that JwtAuthenticationFilter placed on
 * the Spring Security context - never from a client-supplied value. This replaces the
 * previous HeaderAuthenticatedUserProvider, which trusted a plain "X-User-Account-Id" header
 * with no verification at all, letting any caller act as any user account.
 */
@Component
public class JwtAuthenticatedUserProvider implements AuthenticatedUserProvider {

    @Override
    public UUID currentUserAccountId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new MissingAuthenticatedUserException("No authenticated user on this request");
        }
        try {
            return UUID.fromString(authentication.getName());
        } catch (IllegalArgumentException malformedSubject) {
            throw new InvalidAuthenticatedUserException("Authenticated subject is not a valid user account id");
        }
    }
}
