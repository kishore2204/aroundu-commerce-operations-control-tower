package com.cbg.lbos.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.cbg.lbos.dto.CustomerRegistrationRequestDto;
import com.cbg.lbos.dto.UserAccountRequestDto;
import com.cbg.lbos.dto.UserAccountResponseDto;
import com.cbg.lbos.entity.UserAccount;
import com.cbg.lbos.exception.DuplicateResourceException;
import com.cbg.lbos.exception.ResourceNotFoundException;
import com.cbg.lbos.exception.ValidationException;
import com.cbg.lbos.repository.PasswordResetTokenRepository;
import com.cbg.lbos.repository.UserAccountRepository;

@ExtendWith(MockitoExtension.class)
class UserAccountServiceTest {
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private PasswordResetTokenRepository passwordResetTokenRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private com.cbg.lbos.repository.OperationsManagerRepository operationsManagerRepository;

    private UserAccountService userAccountService;
    private UUID userAccountId;
    private UserAccount userAccount;

    @BeforeEach
    void setUp() {
        userAccountService = new UserAccountService(userAccountRepository, passwordResetTokenRepository, passwordEncoder,
                new OperationsManagerStatusSync(operationsManagerRepository, userAccountRepository));
        userAccountId = UUID.randomUUID();
        userAccount = new UserAccount();
        org.springframework.test.util.ReflectionTestUtils.setField(userAccount, "id", userAccountId);
        userAccount.setEmail("test@example.com");
        userAccount.setPhoneNumber("9876543210");
        userAccount.setPasswordHash("encoded");
        userAccount.setFirstName("Test");
        userAccount.setLastName("User");
        userAccount.setRole("SERVICE");
        userAccount.setAccountStatus("ACTIVE");
    }

    private UserAccountRequestDto validRequest() {
        UserAccountRequestDto request = new UserAccountRequestDto();
        request.setEmail(" Test@Example.com ");
        request.setPhoneNumber(" 9876543210 ");
        request.setPassword("Password@123");
        request.setFirstName(" Test ");
        request.setLastName(" User ");
        request.setRole("SERVICE");
        request.setAccountStatus("ACTIVE");
        return request;
    }


    @Test
    void registerCustomerAlwaysCreatesCustomerRole() {
        CustomerRegistrationRequestDto request = new CustomerRegistrationRequestDto();
        request.setEmail("newcustomer@example.com");
        request.setPhoneNumber("9876543211");
        request.setPassword("Customer@123");
        request.setFirstName("New");
        request.setLastName("Customer");

        when(userAccountRepository.existsByEmailIgnoreCase("newcustomer@example.com")).thenReturn(false);
        when(userAccountRepository.existsByPhoneNumber("9876543211")).thenReturn(false);
        when(passwordEncoder.encode("Customer@123")).thenReturn("encoded-customer-password");
        when(userAccountRepository.save(any(UserAccount.class))).thenAnswer(invocation -> {
            UserAccount savedAccount = invocation.getArgument(0);
            org.springframework.test.util.ReflectionTestUtils.setField(savedAccount, "id", userAccountId);
            return savedAccount;
        });

        UserAccountResponseDto result = userAccountService.registerCustomer(request);

        assertEquals("CUSTOMER", result.getRole());
        assertEquals("ACTIVE", result.getAccountStatus());
        verify(passwordEncoder).encode("Customer@123");
    }

    @Test
    void registerCustomerRejectsDuplicateEmail() {
        CustomerRegistrationRequestDto request = new CustomerRegistrationRequestDto();
        request.setEmail("newcustomer@example.com");
        request.setPhoneNumber("9876543211");
        request.setPassword("Customer@123");
        request.setFirstName("New");
        request.setLastName("Customer");

        when(userAccountRepository.existsByEmailIgnoreCase("newcustomer@example.com")).thenReturn(true);

        assertThrows(DuplicateResourceException.class,
                () -> userAccountService.registerCustomer(request));
        verify(userAccountRepository, never()).save(any());
    }

    @Test
    void createRejectsNullRequest() {
        assertThrows(ValidationException.class, () -> userAccountService.createUserAccount(null));
        verifyNoInteractions(userAccountRepository, passwordEncoder);
    }

    @Test
    void createNormalizesValuesAndEncodesPassword() {
        when(userAccountRepository.existsByEmailIgnoreCase("test@example.com")).thenReturn(false);
        when(userAccountRepository.existsByPhoneNumber("9876543210")).thenReturn(false);
        when(passwordEncoder.encode("Password@123")).thenReturn("encoded-password");
        when(userAccountRepository.save(any(UserAccount.class))).thenAnswer(invocation -> {
            UserAccount savedAccount = invocation.getArgument(0);
            org.springframework.test.util.ReflectionTestUtils.setField(savedAccount, "id", userAccountId);
            return savedAccount;
        });

        UserAccountResponseDto result = userAccountService.createUserAccount(validRequest());

        assertEquals(userAccountId, result.getId());
        assertEquals("test@example.com", result.getEmail());
        assertEquals("9876543210", result.getPhoneNumber());
        assertEquals("SERVICE", result.getRole());
        assertEquals("ACTIVE", result.getAccountStatus());
        verify(passwordEncoder).encode("Password@123");
    }

    @Test
    void createRejectsDuplicateEmail() {
        when(userAccountRepository.existsByEmailIgnoreCase("test@example.com")).thenReturn(true);

        assertThrows(DuplicateResourceException.class,
                () -> userAccountService.createUserAccount(validRequest()));
        verify(userAccountRepository, never()).save(any());
    }

    @Test
    void createRejectsDuplicatePhone() {
        when(userAccountRepository.existsByEmailIgnoreCase("test@example.com")).thenReturn(false);
        when(userAccountRepository.existsByPhoneNumber("9876543210")).thenReturn(true);

        assertThrows(DuplicateResourceException.class,
                () -> userAccountService.createUserAccount(validRequest()));
    }

    @Test
    void createRejectsInvalidEmail() {
        UserAccountRequestDto request = validRequest();
        request.setEmail("invalid-email");

        assertThrows(ValidationException.class, () -> userAccountService.createUserAccount(request));
    }

    @Test
    void createRejectsInvalidPhone() {
        UserAccountRequestDto request = validRequest();
        request.setPhoneNumber("12345");

        assertThrows(ValidationException.class, () -> userAccountService.createUserAccount(request));
    }

    @Test
    void createRejectsWeakPassword() {
        UserAccountRequestDto request = validRequest();
        request.setPassword("password123");

        assertThrows(ValidationException.class, () -> userAccountService.createUserAccount(request));
    }

    @Test
    void createRejectsMissingRequiredField() {
        UserAccountRequestDto request = validRequest();
        request.setFirstName(" ");

        assertThrows(ValidationException.class, () -> userAccountService.createUserAccount(request));
    }

    @Test
    void getAllMapsAccounts() {
        when(userAccountRepository.findAll()).thenReturn(List.of(userAccount));

        List<UserAccountResponseDto> result = userAccountService.getAllUserAccounts();

        assertEquals(1, result.size());
        assertEquals(userAccountId, result.get(0).getId());
    }

    @Test
    void getByIdReturnsAccount() {
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));

        assertEquals(userAccountId, userAccountService.getUserAccountById(userAccountId).getId());
    }

    @Test
    void getByIdRejectsNull() {
        assertThrows(ValidationException.class, () -> userAccountService.getUserAccountById(null));
        verifyNoInteractions(userAccountRepository);
    }

    @Test
    void getByIdThrowsNotFound() {
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> userAccountService.getUserAccountById(userAccountId));
    }

    @Test
    void getByEmailNormalizesInput() {
        when(userAccountRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(userAccount));

        assertEquals(userAccountId,
                userAccountService.getUserAccountByEmail(" TEST@example.com ").getId());
    }

    @Test
    void getByEmailRejectsInvalidEmail() {
        assertThrows(ValidationException.class,
                () -> userAccountService.getUserAccountByEmail("not-an-email"));
    }

    @Test
    void getByEmailThrowsNotFound() {
        when(userAccountRepository.findByEmailIgnoreCase("missing@example.com")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> userAccountService.getUserAccountByEmail("missing@example.com"));
    }

    @Test
    void getByRoleNormalizesInput() {
        when(userAccountRepository.findByRoleIgnoreCase("SERVICE")).thenReturn(List.of(userAccount));

        assertEquals(1, userAccountService.getUserAccountsByRole(" service ").size());
        verify(userAccountRepository).findByRoleIgnoreCase("SERVICE");
    }

    @Test
    void getByRoleRejectsBlank() {
        assertThrows(ValidationException.class, () -> userAccountService.getUserAccountsByRole(" "));
    }

    @Test
    void getByStatusNormalizesInput() {
        when(userAccountRepository.findByAccountStatusIgnoreCase("ACTIVE")).thenReturn(List.of(userAccount));

        assertEquals(1, userAccountService.getUserAccountsByStatus(" active ").size());
        verify(userAccountRepository).findByAccountStatusIgnoreCase("ACTIVE");
    }

    @Test
    void getByStatusRejectsBlank() {
        assertThrows(ValidationException.class, () -> userAccountService.getUserAccountsByStatus(" "));
    }

    @Test
    void updateRejectsNullRequest() {
        assertThrows(ValidationException.class, () -> userAccountService.updateUserAccount(userAccountId, null));
        verifyNoInteractions(userAccountRepository, passwordEncoder);
    }

    @Test
    void updateChangesFieldsAndPassword() {
        UserAccountRequestDto request = validRequest();
        request.setEmail("new@example.com");
        request.setPhoneNumber("9999999999");
        request.setPassword("NewPassword@123");

        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));
        when(userAccountRepository.existsByEmailIgnoreCase("new@example.com")).thenReturn(false);
        when(userAccountRepository.existsByPhoneNumber("9999999999")).thenReturn(false);
        when(passwordEncoder.encode("NewPassword@123")).thenReturn("new-encoded");
        when(userAccountRepository.save(userAccount)).thenReturn(userAccount);

        UserAccountResponseDto result = userAccountService.updateUserAccount(userAccountId, request);

        assertEquals("new@example.com", result.getEmail());
        assertEquals("9999999999", result.getPhoneNumber());
        assertEquals("new-encoded", userAccount.getPasswordHash());
        assertNotNull(userAccount.getPasswordChangedOn());
        verify(userAccountRepository).save(userAccount);
    }

    @Test
    void updateAllowsPartialUpdate() {
        UserAccountRequestDto request = new UserAccountRequestDto();
        request.setFirstName(" Updated ");
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));
        when(userAccountRepository.save(userAccount)).thenReturn(userAccount);

        UserAccountResponseDto result = userAccountService.updateUserAccount(userAccountId, request);

        assertEquals("Updated", result.getFirstName());
        assertEquals("test@example.com", result.getEmail());
    }

    @Test
    void updateRejectsDuplicateEmail() {
        UserAccountRequestDto request = new UserAccountRequestDto();
        request.setEmail("other@example.com");
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));
        when(userAccountRepository.existsByEmailIgnoreCase("other@example.com")).thenReturn(true);

        assertThrows(DuplicateResourceException.class,
                () -> userAccountService.updateUserAccount(userAccountId, request));
        verify(userAccountRepository, never()).save(any());
    }

    @Test
    void updateRejectsDuplicatePhone() {
        UserAccountRequestDto request = new UserAccountRequestDto();
        request.setPhoneNumber("9999999999");
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));
        when(userAccountRepository.existsByPhoneNumber("9999999999")).thenReturn(true);

        assertThrows(DuplicateResourceException.class,
                () -> userAccountService.updateUserAccount(userAccountId, request));
    }

    @Test
    void updateRejectsWeakPassword() {
        UserAccountRequestDto request = new UserAccountRequestDto();
        request.setPassword("password123");
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));

        assertThrows(ValidationException.class,
                () -> userAccountService.updateUserAccount(userAccountId, request));
        verify(userAccountRepository, never()).save(any());
    }

    @Test
    void updateLastLoginSetsTimestamp() {
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));
        when(userAccountRepository.save(userAccount)).thenReturn(userAccount);

        UserAccountResponseDto result = userAccountService.updateLastLogin(userAccountId);

        assertNotNull(result.getLastLoginAt());
        verify(userAccountRepository).save(userAccount);
    }

    @Test
    void updateAccountStatusPersistsNormalizedStatus() {
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));
        when(userAccountRepository.save(userAccount)).thenReturn(userAccount);

        UserAccountResponseDto result = userAccountService.updateAccountStatus(userAccountId, "  suspended  ");

        assertEquals("SUSPENDED", result.getAccountStatus());
        verify(userAccountRepository).save(userAccount);
    }

    @Test
    void updateAccountStatusRejectsBlankStatus() {
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));

        assertThrows(ValidationException.class, () -> userAccountService.updateAccountStatus(userAccountId, "  "));
        verify(userAccountRepository, never()).save(any());
    }

    @Test
    void deleteDeletesExistingAccount() {
        when(userAccountRepository.findById(userAccountId)).thenReturn(Optional.of(userAccount));

        userAccountService.deleteUserAccount(userAccountId);

        verify(userAccountRepository).delete(userAccount);
    }
}
