package com.lbos.commercecustomer.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import com.lbos.commercecustomer.dto.request.AddressRequest;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;

/** The postal code of an address is exactly six digits - or empty (it is optional). Enforced by the backend, not only the form. */
class AddressRequestPostalCodeTest {
    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll static void start() { factory = Validation.buildDefaultValidatorFactory(); validator = factory.getValidator(); }
    @AfterAll static void stop() { factory.close(); }

    private Set<ConstraintViolation<AddressRequest>> validate(String postalCode) {
        return validator.validate(new AddressRequest("Chennai", "North", "HOME", "Flat 4B, Sri Lakshmi Apartments", null, postalCode, null, null, false));
    }

    @Test void sixDigitsAreAccepted() { assertTrue(validate("600011").stream().noneMatch(v -> v.getPropertyPath().toString().equals("postalCode"))); }
    @Test void nullAndEmptyAreAccepted() {
        assertTrue(validate(null).stream().noneMatch(v -> v.getPropertyPath().toString().equals("postalCode")));
        assertTrue(validate("").stream().noneMatch(v -> v.getPropertyPath().toString().equals("postalCode")));
    }
    @Test void wrongLengthLettersAndSpacesAreRejected() {
        for (String bad : new String[] {"6000", "6000111", "60001a", "600 011", "-60011"}) {
            assertEquals(1, validate(bad).stream().filter(v -> v.getPropertyPath().toString().equals("postalCode")).count(), bad);
        }
    }
}
