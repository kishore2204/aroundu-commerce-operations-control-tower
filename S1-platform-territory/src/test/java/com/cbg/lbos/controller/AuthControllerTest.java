package com.cbg.lbos.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.cbg.lbos.dto.CustomerRegistrationRequestDto;
import com.cbg.lbos.dto.LoginRequestDto;
import com.cbg.lbos.dto.UserAccountResponseDto;
import com.cbg.lbos.dto.LoginResponseDto;
import com.cbg.lbos.entity.UserAccount;
import com.cbg.lbos.exception.InvalidCredentialsException;
import com.cbg.lbos.exception.PasswordExpiredException;
import com.cbg.lbos.repository.UserAccountRepository;
import com.cbg.lbos.security.JwtService;
import com.cbg.lbos.service.LoginEligibilityService;
import com.cbg.lbos.service.UserAccountService;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private UserAccountRepository userAccountRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtService jwtService;
    @Mock
    private UserAccountService userAccountService;
    @Mock
    private LoginEligibilityService loginEligibilityService;

    private AuthController authController;
    private UserAccount account;

    @BeforeEach
    void setUp() {
        authController = new AuthController(userAccountRepository, passwordEncoder, jwtService, userAccountService,
                loginEligibilityService);
        account = new UserAccount();
        account.setEmail("manager@aroundu.local");
        account.setPasswordHash("encoded-hash");
        account.setRole("OPERATIONS_MANAGER");
        account.setAccountStatus("ACTIVE");
        account.setPasswordChangedOn(java.time.OffsetDateTime.now().minusDays(10));
    }


    @Test
    void registerCustomerCreatesCustomerRole() {
        CustomerRegistrationRequestDto request = new CustomerRegistrationRequestDto();
        request.setEmail("customer@aroundu.local");
        request.setPhoneNumber("9876543210");
        request.setPassword("Customer@123");
        request.setFirstName("Demo");
        request.setLastName("Customer");

        UserAccountResponseDto responseDto = new UserAccountResponseDto();
        responseDto.setEmail("customer@aroundu.local");
        responseDto.setRole("CUSTOMER");
        when(userAccountService.registerCustomer(request)).thenReturn(responseDto);

        ResponseEntity<UserAccountResponseDto> response =
                authController.registerCustomer(request);

        assertEquals(201, response.getStatusCode().value());
        assertEquals("CUSTOMER", response.getBody().getRole());
        verify(userAccountService).registerCustomer(request);
    }

    @Test
    void loginWithValidCredentialsReturnsToken() {
        when(userAccountRepository.findByEmailIgnoreCase("manager@aroundu.local")).thenReturn(Optional.of(account));
        when(passwordEncoder.matches("correct-password", "encoded-hash")).thenReturn(true);
        when(jwtService.generateToken(account.getId(), account.getEmail(), account.getRole())).thenReturn("signed.jwt.token");
        when(jwtService.expirationSeconds()).thenReturn(3600L);
        when(userAccountRepository.save(account)).thenReturn(account);

        LoginRequestDto request = new LoginRequestDto();
        request.setEmail("Manager@AroundU.local");
        request.setPassword("correct-password");

        ResponseEntity<LoginResponseDto> response = authController.login(request);

        assertEquals(200, response.getStatusCode().value());
        assertEquals("signed.jwt.token", response.getBody().getAccessToken());
        assertEquals("OPERATIONS_MANAGER", response.getBody().getRole());
        verify(userAccountRepository).save(account);
        assertNotNull(account.getLastLoginAt());
    }

    @Test
    void loginWithWrongPasswordThrowsInvalidCredentials() {
        when(userAccountRepository.findByEmailIgnoreCase("manager@aroundu.local")).thenReturn(Optional.of(account));
        when(passwordEncoder.matches("wrong-password", "encoded-hash")).thenReturn(false);

        LoginRequestDto request = new LoginRequestDto();
        request.setEmail("manager@aroundu.local");
        request.setPassword("wrong-password");

        assertThrows(InvalidCredentialsException.class, () -> authController.login(request));
        verify(userAccountRepository, never()).save(any());
    }

    @Test
    void loginWithUnknownEmailThrowsInvalidCredentials() {
        when(userAccountRepository.findByEmailIgnoreCase("nobody@aroundu.local")).thenReturn(Optional.empty());

        LoginRequestDto request = new LoginRequestDto();
        request.setEmail("nobody@aroundu.local");
        request.setPassword("whatever");

        assertThrows(InvalidCredentialsException.class, () -> authController.login(request));
    }

    @Test
    void loginWithInactiveAccountThrowsInvalidCredentials() {
        account.setAccountStatus("SUSPENDED");
        when(userAccountRepository.findByEmailIgnoreCase("manager@aroundu.local")).thenReturn(Optional.of(account));
        when(passwordEncoder.matches("correct-password", "encoded-hash")).thenReturn(true);

        LoginRequestDto request = new LoginRequestDto();
        request.setEmail("manager@aroundu.local");
        request.setPassword("correct-password");

        assertThrows(InvalidCredentialsException.class, () -> authController.login(request));
        verify(userAccountRepository, never()).save(any());
    }

    @Test
    void loginRejectedByRoleHierarchyNeverGeneratesToken() {
        when(userAccountRepository.findByEmailIgnoreCase("manager@aroundu.local")).thenReturn(Optional.of(account));
        when(passwordEncoder.matches("correct-password", "encoded-hash")).thenReturn(true);
        doThrow(new InvalidCredentialsException("Your supervising Operations Manager is inactive"))
                .when(loginEligibilityService).assertMayLogIn(account);

        LoginRequestDto request = new LoginRequestDto();
        request.setEmail("manager@aroundu.local");
        request.setPassword("correct-password");

        InvalidCredentialsException failure =
                assertThrows(InvalidCredentialsException.class, () -> authController.login(request));
        assertEquals("Your supervising Operations Manager is inactive", failure.getMessage());
        verify(jwtService, never()).generateToken(any(), any(), any());
        verify(userAccountRepository, never()).save(any());
    }

    @Test
    void loginWithExpiredPasswordThrowsPasswordExpired() {
        account.setPasswordChangedOn(java.time.OffsetDateTime.now().minusDays(91));
        when(userAccountRepository.findByEmailIgnoreCase("manager@aroundu.local")).thenReturn(Optional.of(account));
        when(passwordEncoder.matches("correct-password", "encoded-hash")).thenReturn(true);

        LoginRequestDto request = new LoginRequestDto();
        request.setEmail("manager@aroundu.local");
        request.setPassword("correct-password");

        assertThrows(PasswordExpiredException.class, () -> authController.login(request));
        verify(userAccountRepository, never()).save(any());
    }

    @Test
    void loginWithNullPasswordChangedOnThrowsPasswordExpired() {
        account.setPasswordChangedOn(null);
        when(userAccountRepository.findByEmailIgnoreCase("manager@aroundu.local")).thenReturn(Optional.of(account));
        when(passwordEncoder.matches("correct-password", "encoded-hash")).thenReturn(true);

        LoginRequestDto request = new LoginRequestDto();
        request.setEmail("manager@aroundu.local");
        request.setPassword("correct-password");

        assertThrows(PasswordExpiredException.class, () -> authController.login(request));
        verify(userAccountRepository, never()).save(any());
    }
}
