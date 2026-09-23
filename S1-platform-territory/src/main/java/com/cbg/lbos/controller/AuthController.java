package com.cbg.lbos.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import com.cbg.lbos.dto.CustomerRegistrationRequestDto;
import com.cbg.lbos.dto.ForgotPasswordRequestDto;
import com.cbg.lbos.dto.ForgotPasswordResponseDto;
import com.cbg.lbos.dto.ResetPasswordRequestDto;
import com.cbg.lbos.dto.UserAccountResponseDto;
import com.cbg.lbos.dto.LoginRequestDto;
import com.cbg.lbos.dto.LoginResponseDto;
import com.cbg.lbos.entity.UserAccount;
import com.cbg.lbos.exception.InvalidCredentialsException;
import com.cbg.lbos.exception.PasswordExpiredException;
import com.cbg.lbos.repository.UserAccountRepository;
import com.cbg.lbos.service.LoginEligibilityService;
import com.cbg.lbos.service.UserAccountService;
import com.cbg.lbos.security.JwtService;

import jakarta.validation.Valid;

import java.time.Duration;
import java.time.OffsetDateTime;

/**
 * Issues platform-wide JWTs for {@link UserAccount} holders. This is the single login endpoint
 * for the whole system: the API Gateway forwards {@code POST /api/v1/auth/login} here, then
 * validates every subsequent request's bearer token itself using the same signing secret.
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    /** Password age policy: credentials older than this are rejected at login. */
    private static final long MAX_PASSWORD_AGE_DAYS = 90;

    private final UserAccountRepository userAccountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final UserAccountService userAccountService;
    private final LoginEligibilityService loginEligibilityService;

    public AuthController(UserAccountRepository userAccountRepository, PasswordEncoder passwordEncoder,
            JwtService jwtService, UserAccountService userAccountService,
            LoginEligibilityService loginEligibilityService) {
        this.userAccountRepository = userAccountRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.userAccountService = userAccountService;
        this.loginEligibilityService = loginEligibilityService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponseDto> login(@Valid @RequestBody LoginRequestDto request) {
        UserAccount account = userAccountRepository.findByEmailIgnoreCase(request.getEmail().trim().toLowerCase())
                .orElseThrow(() -> new InvalidCredentialsException("Invalid email or password"));
        if (!passwordMatches(request.getPassword(), account.getPasswordHash())) {
            throw new InvalidCredentialsException("Invalid email or password");
        }
        if (!"ACTIVE".equalsIgnoreCase(account.getAccountStatus())) {
            if ("DRIVER".equalsIgnoreCase(account.getRole()) && "PENDING_VERIFICATION".equalsIgnoreCase(account.getAccountStatus())) {
                throw new InvalidCredentialsException("Your driver account is not verified yet. Please wait for verification approval before signing in.");
            }
            throw new InvalidCredentialsException("Account is not active");
        }
        // Role assignment / parent-account hierarchy (e.g. a Location Manager whose Operations
        // Manager is inactive) - must be settled before any token is issued below.
        loginEligibilityService.assertMayLogIn(account);
        if (account.getPasswordChangedOn() == null
                || Duration.between(account.getPasswordChangedOn(), OffsetDateTime.now()).toDays() > MAX_PASSWORD_AGE_DAYS) {
            throw new PasswordExpiredException("Password has expired; it must be changed before logging in");
        }
        account.setLastLoginAt(OffsetDateTime.now());
        userAccountRepository.save(account);
        String token = jwtService.generateToken(account.getId(), account.getEmail(), account.getRole());
        return ResponseEntity.ok(new LoginResponseDto(token, jwtService.expirationSeconds(), account.getId(), account.getEmail(), account.getRole()));
    }

    /**
     * The exact password always wins. Only when it does not match AND it has leading/trailing whitespace is the trimmed
     * value tried as well: a phone keyboard's predictive-text space, an autofill or a copy/paste routinely adds one, and
     * that showed up as a random "Invalid email or password" on another device. The extra bcrypt check happens only for
     * an already-failing attempt that has such whitespace, so a correct login costs exactly what it did before.
     */
    boolean passwordMatches(String submitted, String passwordHash) {
        if (submitted == null) return false;
        if (passwordEncoder.matches(submitted, passwordHash)) return true;
        String trimmed = submitted.strip();
        return !trimmed.equals(submitted) && !trimmed.isEmpty() && passwordEncoder.matches(trimmed, passwordHash);
    }

    @PostMapping("/register/customer")
    public ResponseEntity<UserAccountResponseDto> registerCustomer(
            @Valid @RequestBody CustomerRegistrationRequestDto request) {
        return ResponseEntity.status(201).body(userAccountService.registerCustomer(request));
    }

    @PostMapping("/register")
    public ResponseEntity<UserAccountResponseDto> registerPublic(
            @Valid @RequestBody com.cbg.lbos.dto.UserAccountRequestDto request) {
        return ResponseEntity.status(201).body(userAccountService.registerPublicUser(request));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ForgotPasswordResponseDto> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequestDto request) {
        return ResponseEntity.ok(userAccountService.requestPasswordReset(request.getEmail()));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequestDto request) {
        userAccountService.resetPassword(request.getToken(), request.getNewPassword());
        return ResponseEntity.ok().build();
    }

}

