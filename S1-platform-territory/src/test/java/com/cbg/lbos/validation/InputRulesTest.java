package com.cbg.lbos.validation;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class InputRulesTest {

    @Test
    void passwordNeedsLengthUppercaseLowercaseNumberAndSpecialCharacter() {
        assertTrue(PasswordPolicy.isValid("Abcdef1!"));
        assertTrue(PasswordPolicy.isValid("Driver@123"));
        assertFalse(PasswordPolicy.isValid("Abcde1!"));          // 7 characters
        assertFalse(PasswordPolicy.isValid("abcdefg1!"));        // no uppercase
        assertFalse(PasswordPolicy.isValid("ABCDEFG1!"));        // no lowercase
        assertFalse(PasswordPolicy.isValid("Abcdefgh!"));        // no number
        assertFalse(PasswordPolicy.isValid("Abcdefg12"));        // no special character
        assertFalse(PasswordPolicy.isValid("Abcdefg1 "));        // a space is not a special character
        assertFalse(PasswordPolicy.isValid(null));
    }

    @Test
    void passwordIsCappedAtTheExistingBackendLimit() {
        assertTrue(PasswordPolicy.isValid("Aa1!" + "x".repeat(68)));   // 72
        assertFalse(PasswordPolicy.isValid("Aa1!" + "x".repeat(69)));  // 73
    }

    @Test
    void mobileNumberIsExactlyTenDigits() {
        assertTrue(MobileNumberRule.isValid("9876543210"));
        assertFalse(MobileNumberRule.isValid("987654321"));
        assertFalse(MobileNumberRule.isValid("98765432101"));
        assertFalse(MobileNumberRule.isValid("98765 43210"));
        assertFalse(MobileNumberRule.isValid("+919876543210"));
        assertFalse(MobileNumberRule.isValid("98765abcde"));
        assertFalse(MobileNumberRule.isValid(null));
    }
}
