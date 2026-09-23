package com.cbg.lbos.validation;

/*
##################################################################

                                           TK_INC0010070_Mobile_Number_Validation_3230833

#####################################################################
*/
/** The single mobile-number rule of the platform: exactly 10 digits, digits only. */
public final class MobileNumberRule {

    public static final String REGEX = "^[0-9]{10}$";
    public static final String MESSAGE = "Mobile number must be exactly 10 digits";

    private MobileNumberRule() {
    }

    public static boolean isValid(String value) {
        return value != null && value.matches(REGEX);
    }
}
