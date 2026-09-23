package com.cbg.lbos.validation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;

import com.cbg.lbos.dto.CustomerRegistrationRequestDto;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;

/** The e-mail rule behind registration and account creation: what is accepted, and what the user is told when it is not. */
class EmailRuleTest {

    private static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void validAddressesAreAccepted() {
        for (String email : List.of("user@example.com", "first.last@example.co.in", "user+tag@example.com", "a1@b2.io", "USER@EXAMPLE.COM", "op.ch@lbos.com")) {
            assertTrue(EmailRule.isValid(email), email);
        }
    }

    @Test
    void invalidAddressesAreRejected() {
        for (String email : List.of("user", "user@", "@example.com", "user@example", "user @example.com", "user@exa mple.com",
                "user@@example.com", "user@example.c", "user..name@example.com", ".user@example.com", "user.@example.com",
                "user@-example.com", "user@example..com", "user@example.com.", "user@example,com", "")) {
            assertFalse(EmailRule.isValid(email), "'" + email + "' must be rejected");
        }
        assertFalse(EmailRule.isValid(null));
        assertFalse(EmailRule.isValid("a".repeat(150) + "@example.com"), "longer than 160 characters");
    }

    @Test
    void surroundingWhitespaceIsDroppedAndABlankValueBecomesMissing() {
        assertEquals("user@example.com", EmailRule.normalize("  user@example.com \t"));
        assertNull(EmailRule.normalize("   "));
        assertNull(EmailRule.normalize(null));
    }

    private static CustomerRegistrationRequestDto registration(String email) {
        CustomerRegistrationRequestDto dto = new CustomerRegistrationRequestDto();
        dto.setEmail(email);
        dto.setPhoneNumber("9876543210");
        dto.setPassword("Lbos@2026!");
        dto.setFirstName("Priya");
        dto.setLastName("Sharma");
        dto.setTermsAccepted(true);
        return dto;
    }

    private static List<String> emailMessages(CustomerRegistrationRequestDto dto) {
        Set<ConstraintViolation<CustomerRegistrationRequestDto>> violations = VALIDATOR.validate(dto);
        return violations.stream().filter((v) -> v.getPropertyPath().toString().equals("email")).map(ConstraintViolation::getMessage)
                .collect(Collectors.toList());
    }

    @Test
    void aDirectRegistrationRequestWithABlankOrWhitespaceEmailIsToldItIsRequired() {
        assertEquals(List.of("Email is required."), emailMessages(registration(null)));
        assertEquals(List.of("Email is required."), emailMessages(registration("")));
        assertEquals(List.of("Email is required."), emailMessages(registration("     ")));
    }

    @Test
    void aDirectRegistrationRequestWithAnInvalidEmailIsToldToEnterAValidOne() {
        for (String email : List.of("user", "user@", "@example.com", "user@example", "user @example.com")) {
            assertEquals(List.of("Enter a valid email address."), emailMessages(registration(email)), email);
        }
    }

    @Test
    void aValidEmailWithSurroundingSpacesIsAcceptedAndStoredTrimmed() {
        CustomerRegistrationRequestDto dto = registration("  first.last@example.co.in  ");
        assertEquals("first.last@example.co.in", dto.getEmail());
        assertTrue(emailMessages(dto).isEmpty());
    }
}
