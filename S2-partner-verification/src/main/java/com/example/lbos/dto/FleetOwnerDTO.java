package com.example.lbos.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(description = "Fleet Owner Data Transfer Object")
public class FleetOwnerDTO {

    @Schema(description = "Unique identifier of the fleet owner", example = "123e4567-e89b-12d3-a456-426614174000", accessMode = Schema.AccessMode.READ_ONLY)
    private UUID fleetOwnerId;

    @NotNull(message = "userAccountId cannot be null")
    @Schema(description = "User account ID associated with the fleet owner", example = "123e4567-e89b-12d3-a456-426614174001")
    private UUID userAccountId;

    @Schema(description = "Operations manager ID", example = "123e4567-e89b-12d3-a456-426614174002")
    private UUID operationsManagerId;

    @NotNull(message = "cityId cannot be null")
    @Schema(description = "City ID where the fleet owner operates", example = "123e4567-e89b-12d3-a456-426614174003")
    private UUID cityId;

    @Schema(description = "Zone ID (subdivision of the city) used to route verification requests to the correct Location Manager", example = "123e4567-e89b-12d3-a456-426614174005")
    private UUID zoneId;

    @Schema(description = "Fleet owner's business name", example = "ABC Logistics")
    private String businessName;

    @Schema(description = "Account ID of the user who verified the bank details", example = "123e4567-e89b-12d3-a456-426614174004")
    private UUID bankVerifiedByAccountId;

    @NotBlank(message = "profileStatus cannot be empty")
    @Schema(description = "Profile verification status", example = "VERIFIED")
    private String profileStatus;

    @NotBlank(message = "ownerStatus cannot be empty")
    @Schema(description = "Current status of the fleet owner", example = "ACTIVE")
    private String ownerStatus;

    public FleetOwnerDTO() {}

    public UUID getFleetOwnerId() { return fleetOwnerId; }
    public void setFleetOwnerId(UUID fleetOwnerId) { this.fleetOwnerId = fleetOwnerId; }

    public UUID getUserAccountId() { return userAccountId; }
    public void setUserAccountId(UUID userAccountId) { this.userAccountId = userAccountId; }

    public UUID getOperationsManagerId() { return operationsManagerId; }
    public void setOperationsManagerId(UUID operationsManagerId) { this.operationsManagerId = operationsManagerId; }

    public UUID getCityId() { return cityId; }
    public void setCityId(UUID cityId) { this.cityId = cityId; }

    public UUID getZoneId() { return zoneId; }
    public void setZoneId(UUID zoneId) { this.zoneId = zoneId; }

    public String getBusinessName() { return businessName; }
    public void setBusinessName(String businessName) { this.businessName = businessName; }

    public UUID getBankVerifiedByAccountId() { return bankVerifiedByAccountId; }
    public void setBankVerifiedByAccountId(UUID bankVerifiedByAccountId) { this.bankVerifiedByAccountId = bankVerifiedByAccountId; }

    public String getProfileStatus() { return profileStatus; }
    public void setProfileStatus(String profileStatus) { this.profileStatus = profileStatus; }

    public String getOwnerStatus() { return ownerStatus; }
    public void setOwnerStatus(String ownerStatus) { this.ownerStatus = ownerStatus; }
}
