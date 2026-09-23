package com.example.lbos.validation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;

import com.example.lbos.controller.FleetOwnerDriverController.AddDriverRequest;
import com.example.lbos.controller.FleetOwnerVehicleController.AddVehicleRequest;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;

/** GSTIN, shop registration, driving licence and vehicle number rules S2 applies - what is accepted and what the user is told. */
class BusinessIdentifierRulesTest {

    private static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void validGstinsAreAccepted() {
        for (String gstin : List.of("33ABCDE1234F1Z5", "33AAHFC4521M1ZP", "29AAKFB7310P1ZT", "36AAJFH2764K1ZQ", "07AAACR5055K1ZK")) {
            assertTrue(BusinessIdentifierRules.isValidGstin(gstin), gstin);
        }
    }

    @Test
    void invalidGstinsAreRejected() {
        for (String gstin : List.of("ABCDE1234F", "33ABCDE1234F1", "33ABCDE1234F1Z55", "33ABCDE1234F@Z5", "33abcde1234f1z5",
                "3ABCDE1234F1Z5A", "33ABCDE12345Z5Z", "33ABCDE1234F0Z5", "33ABCDE1234F1Y5", "33 ABCDE1234F1Z5", "")) {
            assertFalse(BusinessIdentifierRules.isValidGstin(gstin), "'" + gstin + "' must be rejected");
        }
        assertFalse(BusinessIdentifierRules.isValidGstin(null));
    }

    @Test
    void aGstinIsStoredUpperCaseWithoutSpaces_soLowerCaseInputIsAcceptedAfterNormalisation() {
        assertEquals("33ABCDE1234F1Z5", BusinessIdentifierRules.normalizeGstin("  33abcde1234f1z5 "));
        assertEquals("33ABCDE1234F1Z5", BusinessIdentifierRules.normalizeGstin("33 abcde 1234 f1z5"));
        assertTrue(BusinessIdentifierRules.isValidGstin(BusinessIdentifierRules.normalizeGstin("33abcde1234f1z5")));
        assertNull(BusinessIdentifierRules.normalizeGstin("   "));
        assertNull(BusinessIdentifierRules.normalizeGstin(null));
    }

    @Test
    void shopRegistrationNumbersAreEightToTwentyFiveLettersDigitsSlashesOrHyphens() {
        for (String value : List.of("MH/SHOP/2026/1234", "TN-REG-2026-4421", "KA12/SHOP-987654", "REG12345", "UDYAM-TN-02-0041867", "A".repeat(25), "12345678")) {
            assertTrue(BusinessIdentifierRules.isValidRegistration(value), value);
        }
        for (String value : List.of("REG1234", "A".repeat(26), "REG 12345", "REG#12345", "REG_12345", "REG.12345", "reg12345", "")) {
            assertFalse(BusinessIdentifierRules.isValidRegistration(value), "'" + value + "' must be rejected");
        }
    }

    @Test
    void aRegistrationNumberIsStoredUpperCaseWithoutAnySpaces() {
        assertEquals("MH/SHOP/2026/1234", BusinessIdentifierRules.normalizeRegistration(" mh/shop /2026/ 1234 "));
        assertTrue(BusinessIdentifierRules.isValidRegistration(BusinessIdentifierRules.normalizeRegistration("tn-reg 2026-4421")));
        assertNull(BusinessIdentifierRules.normalizeRegistration("  "));
    }

    private static List<String> messages(Set<? extends ConstraintViolation<?>> violations) {
        return violations.stream().map(ConstraintViolation::getMessage).sorted().collect(Collectors.toList());
    }

    private static AddDriverRequest driver(String licence) {
        return new AddDriverRequest(UUID.randomUUID(), UUID.randomUUID(), licence, LocalDate.now().plusYears(2));
    }

    private static AddVehicleRequest vehicle(String registration) {
        return new AddVehicleRequest(registration, "BIKE", "Hero", "Splendor", 2023, new BigDecimal("30"));
    }

    @Test
    void aFleetOwnerDriverRequestWithAnInvalidLicenceIsRejectedAndAValidOneIsNormalised() {
        assertEquals(List.of("Enter a valid driving licence number."), messages(VALIDATOR.validate(driver("KA01AB1234"))));
        assertEquals(List.of("Enter a valid driving licence number."), messages(VALIDATOR.validate(driver("KA05@2019004125"))));
        assertEquals(List.of("Driving licence number is required."), messages(VALIDATOR.validate(driver("   "))));
        for (String valid : List.of("TN1420110012345", "KA05201200123456", "ka-05 2012 0012345 6")) {
            assertTrue(messages(VALIDATOR.validate(driver(valid))).isEmpty(), valid);
        }
        assertEquals("TN1420110012345", driver(" tn-14 2011 0012345 ").licenseNumber());
    }

    /** A direct API request cannot bypass the frontend's typing cap: too many characters, too few, or a misplaced digit/letter. */
    @Test
    void aFleetOwnerDriverRequestWithAnOverLengthOrMisplacedLicenceIsRejected() {
        for (String invalid : List.of("TN14201100123456789", "TN1234567890123456789", "T1234567890123", "TNN1234567890123",
                "TN123456789012", "TN12AB4567890123")) {
            assertEquals(List.of("Enter a valid driving licence number."), messages(VALIDATOR.validate(driver(invalid))), invalid);
        }
    }

    @Test
    void aFleetOwnerVehicleRequestWithAnInvalidNumberIsRejectedAndAValidOneIsNormalised() {
        for (String invalid : List.of("KA0512", "DL1CAB1234", "22BH1234ABC", "KA05MH12345", "TAMILNADU1")) {
            assertEquals(List.of("Enter a valid vehicle registration number."), messages(VALIDATOR.validate(vehicle(invalid))), invalid);
        }
        assertEquals(List.of("Vehicle registration number is required."), messages(VALIDATOR.validate(vehicle(" - "))));
        for (String valid : List.of("TN01AB1234", "KA05JK4471", "MH12A1234", "DL3C1234", "22BH1234A", "22-BH-1234-AB", "tn 01 ab 1234")) {
            assertTrue(messages(VALIDATOR.validate(vehicle(valid))).isEmpty(), valid);
        }
        assertEquals("KA05JK4471", vehicle(" ka-05 jk 4471").registrationNumber());
    }

    /** The exact over-length paste from the report (TN-01-AB-00442222222) and other over-length values are rejected, not truncated. */
    @Test
    void aFleetOwnerVehicleRequestWithAnOverLengthNumberIsRejected() {
        for (String invalid : List.of("TN-01-AB-00442222222", "TN01AB00442222222", "DL3C12345678", "22BH1234ABCDE")) {
            assertEquals(List.of("Enter a valid vehicle registration number."), messages(VALIDATOR.validate(vehicle(invalid))), invalid);
        }
    }
}
