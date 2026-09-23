package com.example.lbos.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import com.example.lbos.validation.BusinessIdentifierRules;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.UUID;

@Schema(description = "Retailer Data Transfer Object")
public class RetailerDTO {

    @Schema(description = "Unique identifier of the retailer", example = "123e4567-e89b-12d3-a456-426614174000", accessMode = Schema.AccessMode.READ_ONLY)
    private UUID retailerId;

    @NotNull(message = "userAccountId cannot be null")
    @Schema(description = "User account ID associated with the retailer", example = "123e4567-e89b-12d3-a456-426614174001")
    private UUID userAccountId;

    @Schema(description = "Operations manager ID", example = "123e4567-e89b-12d3-a456-426614174002")
    private UUID operationsManagerId;

    @NotNull(message = "Select a valid city.")
    @Schema(description = "City ID where the retailer is located", example = "123e4567-e89b-12d3-a456-426614174003")
    private UUID cityId;

    @Schema(description = "Zone ID (subdivision of the city) used to route verification requests to the correct Location Manager", example = "123e4567-e89b-12d3-a456-426614174006")
    private UUID zoneId;

    @Schema(description = "Longitude coordinate", example = "78.1234567")
    private BigDecimal longitude;

    @Schema(description = "Latitude coordinate", example = "11.2345678")
    private BigDecimal latitude;

    @NotBlank(message = "Business name is required.")
    @Size(max = 200, message = "Business name must not exceed 200 characters.")
    @Schema(description = "Retailer's business name", example = "ABC Retail Store")
    private String businessName;

    /** Shop registration number - normalised (upper-case, no spaces) here, format-checked in RetailerServiceImpl (only when it is new or changed). */
    @Schema(description = "Retailer's shop registration number (8-25 letters, digits, / or -)", example = "MH/SHOP/2026/1234")
    private String registrationNumber;

    /** GSTIN - normalised (upper-case, no spaces) here, format-checked in RetailerServiceImpl (only when it is new or changed). */
    @Schema(description = "Retailer's GST number", example = "33ABCDE1234F1Z5")
    private String gstNumber;

    @NotBlank(message = "retailerStatus cannot be empty")
    @Schema(description = "Current status of the retailer", example = "ACTIVE")
    private String retailerStatus;

    @Schema(description = "Whether the store is currently open for orders", example = "true")
    private boolean isOpen = true;

    @Schema(description = "Daily opening time", example = "09:00:00")
    private LocalTime opensAt;

    @Schema(description = "Daily closing time", example = "21:00:00")
    private LocalTime closesAt;

    public RetailerDTO() {
    }

    public UUID getRetailerId() {
        return retailerId;
    }

    public void setRetailerId(UUID retailerId) {
        this.retailerId = retailerId;
    }

    public UUID getUserAccountId() {
        return userAccountId;
    }

    public void setUserAccountId(UUID userAccountId) {
        this.userAccountId = userAccountId;
    }

    public UUID getOperationsManagerId() {
        return operationsManagerId;
    }

    public void setOperationsManagerId(UUID operationsManagerId) {
        this.operationsManagerId = operationsManagerId;
    }

    public UUID getCityId() {
        return cityId;
    }

    public void setCityId(UUID cityId) {
        this.cityId = cityId;
    }

    public UUID getZoneId() {
        return zoneId;
    }

    public void setZoneId(UUID zoneId) {
        this.zoneId = zoneId;
    }

    public BigDecimal getLongitude() {
        return longitude;
    }

    public void setLongitude(BigDecimal longitude) {
        this.longitude = longitude;
    }

    public BigDecimal getLatitude() {
        return latitude;
    }

    public void setLatitude(BigDecimal latitude) {
        this.latitude = latitude;
    }

    public String getBusinessName() {
        return businessName;
    }

    public void setBusinessName(String businessName) {
        this.businessName = businessName;
    }

    public String getRegistrationNumber() {
        return registrationNumber;
    }

    public void setRegistrationNumber(String registrationNumber) {
        this.registrationNumber = BusinessIdentifierRules.normalizeRegistration(registrationNumber);
    }

    public String getGstNumber() {
        return gstNumber;
    }

    public void setGstNumber(String gstNumber) {
        this.gstNumber = BusinessIdentifierRules.normalizeGstin(gstNumber);
    }

    public String getRetailerStatus() {
        return retailerStatus;
    }

    public void setRetailerStatus(String retailerStatus) {
        this.retailerStatus = retailerStatus;
    }

    public boolean isOpen() {
        return isOpen;
    }

    public void setOpen(boolean open) {
        isOpen = open;
    }

    public LocalTime getOpensAt() {
        return opensAt;
    }

    public void setOpensAt(LocalTime opensAt) {
        this.opensAt = opensAt;
    }

    public LocalTime getClosesAt() {
        return closesAt;
    }

    public void setClosesAt(LocalTime closesAt) {
        this.closesAt = closesAt;
    }
}
