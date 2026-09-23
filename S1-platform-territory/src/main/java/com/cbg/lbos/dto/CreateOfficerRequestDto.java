package com.cbg.lbos.dto;

import java.util.UUID;
import com.cbg.lbos.validation.PasswordPolicy;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * An Operations Manager creating a new Location Manager officer under themselves in one step:
 * account creation + zone assignment, with the supervising Operations Manager always resolved
 * server-side from the caller's own JWT (see LocationManagerService.createOfficer) - never a
 * client-supplied field, so an Operations Manager can only ever create officers under their own
 * supervision.
 */
public class CreateOfficerRequestDto {
    @NotBlank(message = "First name is required") private String firstName;
    @NotBlank(message = "Last name is required") private String lastName;
    @NotBlank(message = "Email is required") @Email(message = "Email must be valid") private String email;
    @NotBlank(message = "Password is required")
    @Pattern(regexp = PasswordPolicy.REGEX, message = PasswordPolicy.MESSAGE)
    private String password;
    @NotNull(message = "Zone ID is required") private UUID zoneId;

    public String getFirstName() { return firstName; } public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getLastName() { return lastName; } public void setLastName(String lastName) { this.lastName = lastName; }
    public String getEmail() { return email; } public void setEmail(String email) { this.email = email; }
    public String getPassword() { return password; } public void setPassword(String password) { this.password = password; }
    public UUID getZoneId() { return zoneId; } public void setZoneId(UUID zoneId) { this.zoneId = zoneId; }
}
