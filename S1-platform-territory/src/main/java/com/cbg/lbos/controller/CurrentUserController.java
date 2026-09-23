package com.cbg.lbos.controller;

import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import jakarta.validation.Valid;
import com.cbg.lbos.dto.UserAccountRequestDto;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.cbg.lbos.dto.UserAccountResponseDto;
import com.cbg.lbos.exception.MissingAuthenticatedUserException;
import com.cbg.lbos.service.UserAccountService;

/**
 * Returns the profile of whoever the JWT says the caller is. Deliberately never accepts a
 * client-supplied user id - the identity comes only from {@link Authentication#getName()},
 * which {@code JwtAuthenticationFilter} populates from the token's validated subject claim.
 * Every role can call this; it is how the frontend resolves "who am I" right after login
 * without needing SUPER_ADMIN access to the general {@code /api/user-accounts/{id}} endpoint.
 */
@RestController
@RequestMapping("/api/v1/users")
public class CurrentUserController {

    private final UserAccountService userAccountService;

    public CurrentUserController(UserAccountService userAccountService) {
        this.userAccountService = userAccountService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserAccountResponseDto> getCurrentUser(Authentication authentication) {
        UUID authenticatedUserAccountId = resolveAuthenticatedUserAccountId(authentication);
        return ResponseEntity.ok(userAccountService.getUserAccountById(authenticatedUserAccountId));
    }


    /** Updates only the authenticated account, reusing the existing UserAccountService update rules. */
    @PutMapping("/me")
    public ResponseEntity<UserAccountResponseDto> updateCurrentUser(Authentication authentication, @Valid @RequestBody UserAccountRequestDto request) {
        UUID authenticatedUserAccountId = resolveAuthenticatedUserAccountId(authentication);
        // Self-service profile editing must never let the caller change role/status/password here.
        request.setRole(null);
        request.setAccountStatus(null);
        request.setPassword(null);
        return ResponseEntity.ok(userAccountService.updateUserAccount(authenticatedUserAccountId, request));
    }

    private UUID resolveAuthenticatedUserAccountId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new MissingAuthenticatedUserException("No authenticated user on this request");
        }
        try {
            return UUID.fromString(authentication.getName());
        } catch (IllegalArgumentException invalidSubjectException) {
            throw new MissingAuthenticatedUserException("Authenticated subject is not a valid user account id");
        }
    }
}
