package com.cbg.lbos.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.cbg.lbos.dto.ForgotPasswordResponseDto;
import com.cbg.lbos.dto.UserAccountRequestDto;
import com.cbg.lbos.dto.UserAccountResponseDto;
import com.cbg.lbos.entity.PasswordResetToken;
import com.cbg.lbos.entity.UserAccount;
import com.cbg.lbos.exception.DuplicateResourceException;
import com.cbg.lbos.validation.EmailRule;
import com.cbg.lbos.exception.ResourceNotFoundException;
import com.cbg.lbos.exception.ValidationException;
import com.cbg.lbos.repository.PasswordResetTokenRepository;
import com.cbg.lbos.repository.UserAccountRepository;
import com.cbg.lbos.validation.MobileNumberRule;
import com.cbg.lbos.validation.PasswordPolicy;

@Service
@Transactional
public class UserAccountService {

    private static final long PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;

    private final UserAccountRepository userAccountRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final OperationsManagerStatusSync operationsManagerStatusSync;
    private final SecureRandom secureRandom = new SecureRandom();

    public UserAccountService(UserAccountRepository userAccountRepository,
            PasswordResetTokenRepository passwordResetTokenRepository, PasswordEncoder passwordEncoder,
            OperationsManagerStatusSync operationsManagerStatusSync) {
        this.operationsManagerStatusSync = operationsManagerStatusSync;
        this.userAccountRepository = userAccountRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public UserAccountResponseDto createUserAccount(UserAccountRequestDto requestDto) {
        validateCreateRequest(requestDto);
        String email = normalizeAndValidateEmail(requestDto.getEmail());
        String phoneNumber = normalizePhoneNumber(requestDto.getPhoneNumber());

        if (userAccountRepository.existsByEmailIgnoreCase(email)) {
            throw new DuplicateResourceException(EmailRule.DUPLICATE_MESSAGE);
        }
        if (userAccountRepository.existsByPhoneNumber(phoneNumber)) {
            throw new DuplicateResourceException("Phone number already exists");
        }

        UserAccount userAccount = new UserAccount();
        userAccount.setEmail(email);
        userAccount.setPhoneNumber(phoneNumber);
        userAccount.setPasswordHash(passwordEncoder.encode(requestDto.getPassword()));
        userAccount.setPasswordChangedOn(OffsetDateTime.now());
        userAccount.setFirstName(normalizeRequiredText(requestDto.getFirstName(), "First name"));
        userAccount.setLastName(normalizeRequiredText(requestDto.getLastName(), "Last name"));
        userAccount.setRole(validateLength(normalizeRequiredText(requestDto.getRole(), "Role"), 50, "Role").toUpperCase());
        userAccount.setAccountStatus(validateLength(normalizeRequiredText(requestDto.getAccountStatus(), "Account status"), 30, "Account status").toUpperCase());
        return convertToResponseDto(userAccountRepository.save(userAccount));
    }

    @Transactional(readOnly = true)
    public List<UserAccountResponseDto> getAllUserAccounts() {
        return userAccountRepository.findAll().stream().map(this::convertToResponseDto).toList();
    }

    /** Many accounts in one query - used to show names/contacts for a whole page of partners at once. */
    @Transactional(readOnly = true)
    public List<UserAccountResponseDto> getUserAccountsByIds(java.util.Collection<UUID> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return userAccountRepository.findAllById(ids).stream().map(this::convertToResponseDto).toList();
    }

    /** Accounts of the given roles matching a name/email/phone fragment (capped) - S2's partner search. */
    @Transactional(readOnly = true)
    public List<UUID> searchAccountIds(String term, java.util.Collection<String> roles) {
        if (term == null || term.isBlank() || roles == null || roles.isEmpty()) return List.of();
        String pattern = "%" + term.trim().toLowerCase() + "%";
        return userAccountRepository.searchIds(roles.stream().map(String::toUpperCase).toList(), pattern,
                org.springframework.data.domain.PageRequest.of(0, 500));
    }

    @Transactional(readOnly = true)
    public UserAccountResponseDto getUserAccountById(UUID id) {
        return convertToResponseDto(findUserAccountById(id));
    }

    @Transactional(readOnly = true)
    public UserAccountResponseDto getUserAccountByEmail(String email) {
        String normalizedEmail = normalizeAndValidateEmail(email);
        return userAccountRepository.findByEmailIgnoreCase(normalizedEmail)
                .map(this::convertToResponseDto)
                .orElseThrow(() -> new ResourceNotFoundException("User account not found"));
    }

    @Transactional(readOnly = true)
    public List<UserAccountResponseDto> getUserAccountsByRole(String role) {
        String normalizedRole = normalizeRequiredText(role, "Role").toUpperCase();
        return userAccountRepository.findByRoleIgnoreCase(normalizedRole).stream()
                .map(this::convertToResponseDto).toList();
    }

    @Transactional(readOnly = true)
    public List<UserAccountResponseDto> getUserAccountsByStatus(String accountStatus) {
        String normalizedStatus = normalizeRequiredText(accountStatus, "Account status").toUpperCase();
        return userAccountRepository.findByAccountStatusIgnoreCase(normalizedStatus).stream()
                .map(this::convertToResponseDto).toList();
    }

    public UserAccountResponseDto updateUserAccount(UUID id, UserAccountRequestDto requestDto) {
        if (requestDto == null) {
            throw new ValidationException("Request body must not be empty");
        }
        UserAccount userAccount = findUserAccountById(id);
        updateEmail(userAccount, requestDto.getEmail());
        updatePhoneNumber(userAccount, requestDto.getPhoneNumber());

        if (hasText(requestDto.getFirstName())) {
            userAccount.setFirstName(validateLength(requestDto.getFirstName().trim(), 100, "First name"));
        }
        if (hasText(requestDto.getLastName())) {
            userAccount.setLastName(validateLength(requestDto.getLastName().trim(), 100, "Last name"));
        }
        if (hasText(requestDto.getRole())) {
            userAccount.setRole(validateLength(requestDto.getRole().trim(), 50, "Role").toUpperCase());
        }
        if (hasText(requestDto.getAccountStatus())) {
            userAccount.setAccountStatus(validateLength(requestDto.getAccountStatus().trim(), 30, "Account status").toUpperCase());
        }
        if (hasText(requestDto.getPassword())) {
            validatePassword(requestDto.getPassword());
            userAccount.setPasswordHash(passwordEncoder.encode(requestDto.getPassword()));
            userAccount.setPasswordChangedOn(OffsetDateTime.now());
        }
        UserAccount saved = userAccountRepository.save(userAccount);
        if (hasText(requestDto.getAccountStatus())) operationsManagerStatusSync.accountStatusChanged(saved);
        return convertToResponseDto(saved);
    }

    public UserAccountResponseDto updateAccountStatus(UUID id, String accountStatus) {
        UserAccount userAccount = findUserAccountById(id);
        userAccount.setAccountStatus(validateLength(normalizeRequiredText(accountStatus, "Account status"), 30, "Account status").toUpperCase());
        UserAccount saved = userAccountRepository.save(userAccount);
        operationsManagerStatusSync.accountStatusChanged(saved);
        return convertToResponseDto(saved);
    }

    public UserAccountResponseDto updateLastLogin(UUID id) {
        UserAccount userAccount = findUserAccountById(id);
        userAccount.setLastLoginAt(OffsetDateTime.now());
        return convertToResponseDto(userAccountRepository.save(userAccount));
    }

    public void deleteUserAccount(UUID id) {
        UserAccount userAccount = findUserAccountById(id);
        userAccountRepository.delete(userAccount);
    }

    private void updateEmail(UserAccount userAccount, String requestedEmail) {
        if (!hasText(requestedEmail)) {
            return;
        }
        String email = normalizeAndValidateEmail(requestedEmail);
        boolean emailChanged = !userAccount.getEmail().equalsIgnoreCase(email);
        if (emailChanged && userAccountRepository.existsByEmailIgnoreCase(email)) {
            throw new DuplicateResourceException(EmailRule.DUPLICATE_MESSAGE);
        }
        userAccount.setEmail(email);
    }

    private void updatePhoneNumber(UserAccount userAccount, String requestedPhoneNumber) {
        if (!hasText(requestedPhoneNumber)) {
            return;
        }
        String phoneNumber = normalizePhoneNumber(requestedPhoneNumber);
        boolean phoneNumberChanged = !userAccount.getPhoneNumber().equals(phoneNumber);
        if (phoneNumberChanged && userAccountRepository.existsByPhoneNumber(phoneNumber)) {
            throw new DuplicateResourceException("Phone number already exists");
        }
        userAccount.setPhoneNumber(phoneNumber);
    }

    private UserAccount findUserAccountById(UUID id) {
        if (id == null) {
            throw new ValidationException("User account ID must not be null");
        }
        return userAccountRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User account not found with ID: " + id));
    }

    private void validateCreateRequest(UserAccountRequestDto requestDto) {
        if (requestDto == null) {
            throw new ValidationException("Request body must not be empty");
        }
        normalizeAndValidateEmail(requestDto.getEmail());
        normalizePhoneNumber(requestDto.getPhoneNumber());
        validatePassword(requestDto.getPassword());
        normalizeRequiredText(requestDto.getFirstName(), "First name");
        normalizeRequiredText(requestDto.getLastName(), "Last name");
        normalizeRequiredText(requestDto.getRole(), "Role");
        normalizeRequiredText(requestDto.getAccountStatus(), "Account status");
    }

    private String normalizeAndValidateEmail(String email) {
        if (!hasText(email)) {
            throw new ValidationException(EmailRule.REQUIRED_MESSAGE);
        }
        String normalizedEmail = email.trim().toLowerCase();
        if (normalizedEmail.length() > EmailRule.MAX_LENGTH) {
            throw new ValidationException(EmailRule.TOO_LONG_MESSAGE);
        }
        if (!EmailRule.isValid(normalizedEmail)) {
            throw new ValidationException(EmailRule.MESSAGE);
        }
        return normalizedEmail;
    }

    private String normalizePhoneNumber(String phoneNumber) {
        if (!hasText(phoneNumber)) {
            throw new ValidationException("Phone number must not be empty");
        }
        String normalizedPhoneNumber = phoneNumber.trim();
        if (!MobileNumberRule.isValid(normalizedPhoneNumber)) {
            throw new ValidationException(MobileNumberRule.MESSAGE);
        }
        return normalizedPhoneNumber;
    }

    private void validatePassword(String password) {
        if (!hasText(password) || !PasswordPolicy.isValid(password)) {
            throw new ValidationException(PasswordPolicy.MESSAGE);
        }
    }

    private String normalizeRequiredText(String value, String fieldName) {
        if (!hasText(value)) {
            throw new ValidationException(fieldName + " must not be empty");
        }
        return validateLength(value.trim(), 100, fieldName);
    }

    private String validateLength(String value, int maxLength, String fieldName) {
        if (value.length() > maxLength) {
            throw new ValidationException(fieldName + " must not exceed " + maxLength + " characters");
        }
        return value;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private UserAccountResponseDto convertToResponseDto(UserAccount userAccount) {
        UserAccountResponseDto responseDto = new UserAccountResponseDto();
        responseDto.setId(userAccount.getId());
        responseDto.setEmail(userAccount.getEmail());
        responseDto.setPhoneNumber(userAccount.getPhoneNumber());
        responseDto.setFirstName(userAccount.getFirstName());
        responseDto.setLastName(userAccount.getLastName());
        responseDto.setRole(userAccount.getRole());
        responseDto.setAccountStatus(userAccount.getAccountStatus());
        responseDto.setPasswordChangedOn(userAccount.getPasswordChangedOn());
        responseDto.setLastLoginAt(userAccount.getLastLoginAt());
        responseDto.setCreatedAt(userAccount.getCreatedAt());
        responseDto.setUpdatedAt(userAccount.getUpdatedAt());
        return responseDto;
    }

    public UserAccountResponseDto registerCustomer(com.cbg.lbos.dto.CustomerRegistrationRequestDto requestDto) {
        if (requestDto == null) {
            throw new ValidationException("Request body must not be empty");
        }

        String email = normalizeAndValidateEmail(requestDto.getEmail());
        String phoneNumber = normalizePhoneNumber(requestDto.getPhoneNumber());
        validatePassword(requestDto.getPassword());

        if (userAccountRepository.existsByEmailIgnoreCase(email)) {
            throw new DuplicateResourceException(EmailRule.DUPLICATE_MESSAGE);
        }
        if (userAccountRepository.existsByPhoneNumber(phoneNumber)) {
            throw new DuplicateResourceException("Phone number already exists");
        }

        UserAccount userAccount = new UserAccount();
        userAccount.setEmail(email);
        userAccount.setPhoneNumber(phoneNumber);
        userAccount.setPasswordHash(passwordEncoder.encode(requestDto.getPassword()));
        userAccount.setPasswordChangedOn(OffsetDateTime.now());
        userAccount.setFirstName(normalizeRequiredText(requestDto.getFirstName(), "First name"));
        userAccount.setLastName(normalizeRequiredText(requestDto.getLastName(), "Last name"));
        userAccount.setRole("CUSTOMER");
        userAccount.setAccountStatus("ACTIVE");
        userAccount.setTermsAcceptedAt(OffsetDateTime.now());

        return convertToResponseDto(userAccountRepository.save(userAccount));
    }

    public UserAccountResponseDto registerPublicUser(UserAccountRequestDto requestDto) {
        if (requestDto == null) {
            throw new ValidationException("Request body must not be empty");
        }
        if (!requestDto.isTermsAccepted()) {
            throw new ValidationException("You must accept the Terms & Conditions to register");
        }
        String requestedRole = requestDto.getRole() != null ? requestDto.getRole().trim().toUpperCase() : "";
        if (!Set.of("CUSTOMER", "RETAILER", "FLEET_MANAGER").contains(requestedRole)) {
            throw new ValidationException("Public registration is allowed only for Customer, Retailer, or Fleet Owner roles. Privileged roles must be created by authorized personnel.");
        }
        requestDto.setAccountStatus("ACTIVE");
        UserAccountResponseDto response = createUserAccount(requestDto);
        UserAccount userAccount = findUserAccountById(response.getId());
        userAccount.setTermsAcceptedAt(OffsetDateTime.now());
        return convertToResponseDto(userAccountRepository.save(userAccount));
    }

    /**
     * Dev-mode password reset: since no email provider exists anywhere in this codebase, the raw
     * token is returned directly in the response (never stored - only its hash is) instead of
     * being emailed. The message is always the same generic line regardless of whether the email
     * matched an account, to avoid revealing account existence; only the token/link fields are
     * conditional on a match.
     */
    public ForgotPasswordResponseDto requestPasswordReset(String email) {
        String genericMessage = "If an account exists for this email, a password reset link has been generated.";
        Optional<UserAccount> account = userAccountRepository.findByEmailIgnoreCase(normalizeAndValidateEmail(email));
        if (account.isEmpty()) {
            return new ForgotPasswordResponseDto(genericMessage, null, null);
        }

        UserAccount userAccount = account.get();
        passwordResetTokenRepository.deleteByUserAccountId(userAccount.getId());

        byte[] rawTokenBytes = new byte[32];
        secureRandom.nextBytes(rawTokenBytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(rawTokenBytes);

        PasswordResetToken resetToken = new PasswordResetToken();
        resetToken.setUserAccountId(userAccount.getId());
        resetToken.setTokenHash(hashToken(rawToken));
        resetToken.setExpiresAt(OffsetDateTime.now().plusMinutes(PASSWORD_RESET_TOKEN_TTL_MINUTES));
        passwordResetTokenRepository.save(resetToken);

        return new ForgotPasswordResponseDto(genericMessage, rawToken, "/reset-password?token=" + rawToken);
    }

    public void resetPassword(String rawToken, String newPassword) {
        if (!hasText(rawToken)) {
            throw new ValidationException("Reset token must not be empty");
        }
        validatePassword(newPassword);

        PasswordResetToken resetToken = passwordResetTokenRepository.findByTokenHash(hashToken(rawToken))
                .orElseThrow(() -> new ValidationException("This reset link is invalid or has already been used"));
        if (resetToken.getUsedAt() != null) {
            throw new ValidationException("This reset link is invalid or has already been used");
        }
        if (resetToken.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new ValidationException("This reset link has expired; request a new one");
        }

        UserAccount userAccount = findUserAccountById(resetToken.getUserAccountId());
        userAccount.setPasswordHash(passwordEncoder.encode(newPassword));
        userAccount.setPasswordChangedOn(OffsetDateTime.now());
        userAccountRepository.save(userAccount);

        resetToken.setUsedAt(OffsetDateTime.now());
        passwordResetTokenRepository.save(resetToken);
    }

    private String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 must be available on every JVM", e);
        }
    }

}

