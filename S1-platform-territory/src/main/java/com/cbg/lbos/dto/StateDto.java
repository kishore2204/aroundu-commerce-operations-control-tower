package com.cbg.lbos.dto;

import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class StateDto {
    private UUID id;

    @NotBlank(message = "State name must not be empty")
    @Size(max = 100, message = "State name must not exceed 100 characters")
    private String stateName;

    @NotBlank(message = "Country code must not be empty")
    @Pattern(regexp = "^[A-Za-z]{2,10}$", message = "Country code must contain 2 to 10 letters")
    private String countryCode;

    private Boolean isActive;

    public StateDto() {
    }

    public StateDto(UUID id, String stateName, String countryCode, Boolean isActive) {
        this.id = id;
        this.stateName = stateName;
        this.countryCode = countryCode;
        this.isActive = isActive;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getStateName() { return stateName; }
    public void setStateName(String stateName) { this.stateName = stateName; }
    public String getCountryCode() { return countryCode; }
    public void setCountryCode(String countryCode) { this.countryCode = countryCode; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
}
