package com.cbg.lbos.dto;

import com.cbg.lbos.validation.MobileNumberRule;
import com.cbg.lbos.validation.PasswordPolicy;
import com.cbg.lbos.validation.EmailRule;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class UserAccountRequestDto {
    @Pattern(regexp = EmailRule.REGEX, message = EmailRule.MESSAGE)
    @Size(max = 160, message = EmailRule.TOO_LONG_MESSAGE)
    private String email;

    @Pattern(regexp = MobileNumberRule.REGEX, message = MobileNumberRule.MESSAGE)
    private String phoneNumber;

    /* Optional on update (blank = keep the current password); when supplied it must satisfy the platform policy. */
    @Pattern(regexp = PasswordPolicy.REGEX, message = PasswordPolicy.MESSAGE)
    private String password;

    @Size(max = 100, message = "First name must not exceed 100 characters")
    private String firstName;

    @Size(max = 100, message = "Last name must not exceed 100 characters")
    private String lastName;

    @Size(max = 50, message = "Role must not exceed 50 characters")
    private String role;

    @Size(max = 30, message = "Account status must not exceed 30 characters")
    private String accountStatus;

    /*
     * Only enforced for public self-registration (registerPublicUser) - not a bean-validation
     * constraint here, since this same DTO is reused for admin-driven createUserAccount/
     * updateUserAccount, where a privileged operator creating/editing an account on someone
     * else's behalf isn't "accepting" anything themselves.
     */
    private boolean termsAccepted;

    public UserAccountRequestDto() {
    }

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
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getAccountStatus() { return accountStatus; }
    public void setAccountStatus(String accountStatus) { this.accountStatus = accountStatus; }
    public boolean isTermsAccepted() { return termsAccepted; }
    public void setTermsAccepted(boolean termsAccepted) { this.termsAccepted = termsAccepted; }
}
