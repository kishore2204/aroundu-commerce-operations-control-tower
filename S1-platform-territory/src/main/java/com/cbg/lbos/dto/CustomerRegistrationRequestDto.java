package com.cbg.lbos.dto;

import com.cbg.lbos.validation.MobileNumberRule;
import com.cbg.lbos.validation.PasswordPolicy;
import jakarta.validation.constraints.AssertTrue;
import com.cbg.lbos.validation.EmailRule;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class CustomerRegistrationRequestDto {

    @NotNull(message = EmailRule.REQUIRED_MESSAGE)
    @Pattern(regexp = EmailRule.REGEX, message = EmailRule.MESSAGE)
    @Size(max = 160, message = EmailRule.TOO_LONG_MESSAGE)
    private String email;

    @NotBlank
    @Pattern(regexp = MobileNumberRule.REGEX, message = MobileNumberRule.MESSAGE)
    private String phoneNumber;

    @NotBlank
    @Pattern(regexp = PasswordPolicy.REGEX, message = PasswordPolicy.MESSAGE)
    private String password;

    @NotBlank
    @Size(max = 100)
    private String firstName;

    @NotBlank
    @Size(max = 100)
    private String lastName;

    @AssertTrue(message = "You must accept the Terms & Conditions to register")
    private boolean termsAccepted;

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = EmailRule.normalize(email); }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public boolean isTermsAccepted() { return termsAccepted; }
    public void setTermsAccepted(boolean termsAccepted) { this.termsAccepted = termsAccepted; }
}
