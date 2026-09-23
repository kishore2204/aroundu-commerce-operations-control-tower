package com.cbg.lbos.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.cbg.lbos.dto.LoginRequestDto;
import com.cbg.lbos.entity.UserAccount;
import com.cbg.lbos.exception.InvalidCredentialsException;
import com.cbg.lbos.repository.UserAccountRepository;
import com.cbg.lbos.security.JwtService;
import com.cbg.lbos.service.LoginEligibilityService;
import com.cbg.lbos.service.UserAccountService;

/**
 * A password typed with a stray leading/trailing space (phone keyboard predictive text, autofill, copy/paste) used to be rejected
 * as "Invalid email or password" - seen as a random failure when signing in from another device.
 */
@ExtendWith(MockitoExtension.class)
class AuthControllerLoginWhitespaceTest {
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;
    @Mock private UserAccountService userAccountService;
    @Mock private LoginEligibilityService loginEligibilityService;

    private AuthController controller;
    private UserAccount account;

    @BeforeEach
    void setUp() {
        controller = new AuthController(userAccountRepository, passwordEncoder, jwtService, userAccountService, loginEligibilityService);
        account = new UserAccount();
        account.setEmail("customer@aroundu.local");
        account.setPasswordHash("hash");
        account.setRole("CUSTOMER");
        account.setAccountStatus("ACTIVE");
        account.setPasswordChangedOn(java.time.OffsetDateTime.now().minusDays(1));
        when(userAccountRepository.findByEmailIgnoreCase("customer@aroundu.local")).thenReturn(Optional.of(account));
    }

    private LoginRequestDto request(String password) {
        LoginRequestDto request = new LoginRequestDto();
        request.setEmail("customer@aroundu.local");
        request.setPassword(password);
        return request;
    }

    @Test
    void theExactPasswordIsCheckedOnceAndNeverTrimmed() {
        when(passwordEncoder.matches("Secret@123", "hash")).thenReturn(true);
        when(jwtService.generateToken(account.getId(), account.getEmail(), "CUSTOMER")).thenReturn("token");

        assertEquals("token", controller.login(request("Secret@123")).getBody().getAccessToken());

        verify(passwordEncoder, times(1)).matches("Secret@123", "hash");
    }

    @Test
    void aTrailingSpaceFromAKeyboardStillSignsTheUserIn() {
        when(passwordEncoder.matches("Secret@123 ", "hash")).thenReturn(false);
        when(passwordEncoder.matches("Secret@123", "hash")).thenReturn(true);
        when(jwtService.generateToken(account.getId(), account.getEmail(), "CUSTOMER")).thenReturn("token");

        assertEquals("token", controller.login(request("Secret@123 ")).getBody().getAccessToken());
    }

    @Test
    void aGenuinelyWrongPasswordIsStillRejected() {
        when(passwordEncoder.matches("Wrong@123 ", "hash")).thenReturn(false);
        when(passwordEncoder.matches("Wrong@123", "hash")).thenReturn(false);

        assertThrows(InvalidCredentialsException.class, () -> controller.login(request("Wrong@123 ")));
        verify(jwtService, never()).generateToken(any(), any(), any());
    }

    private static <T> T any() { return org.mockito.ArgumentMatchers.any(); }
}
