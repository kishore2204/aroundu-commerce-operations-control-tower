package com.cbg.lbos.dto;

import java.time.OffsetDateTime;
import java.util.UUID;
import jakarta.validation.constraints.NotNull;
import com.cbg.lbos.entity.AssignmentStatus;

public class LocationManagerDto {
    private UUID locationManagerId;
    @NotNull(message = "User account ID is required") private UUID userAccountId;
    private String firstName;
    private String lastName;
    private String email;
    @NotNull(message = "Zone ID is required") private UUID zoneId;
    private String zoneName;
    private UUID cityId;
    private String cityName;
    @NotNull(message = "Operations Manager ID is required") private UUID operationsManagerId;
    private UUID operationsManagerAccountId;
    private AssignmentStatus assignmentStatus;
    private OffsetDateTime assignedAt;
    /** Read-only: state of the assigned zone's city (used to find eligible transfer targets). */
    private UUID stateId;
    /** Read-only: where the officer was before their latest transfer, when there has been one. */
    private String previousZoneName;
    private String previousCityName;
    private OffsetDateTime lastTransferredAt;
    public UUID getLocationManagerId() { return locationManagerId; } public void setLocationManagerId(UUID locationManagerId) { this.locationManagerId = locationManagerId; }
    public UUID getUserAccountId() { return userAccountId; } public void setUserAccountId(UUID userAccountId) { this.userAccountId = userAccountId; }
    public String getFirstName() { return firstName; } public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getLastName() { return lastName; } public void setLastName(String lastName) { this.lastName = lastName; }
    public String getEmail() { return email; } public void setEmail(String email) { this.email = email; }
    public UUID getZoneId() { return zoneId; } public void setZoneId(UUID zoneId) { this.zoneId = zoneId; }
    public String getZoneName() { return zoneName; } public void setZoneName(String zoneName) { this.zoneName = zoneName; }
    public UUID getCityId() { return cityId; } public void setCityId(UUID cityId) { this.cityId = cityId; }
    public String getCityName() { return cityName; } public void setCityName(String cityName) { this.cityName = cityName; }
    public UUID getOperationsManagerId() { return operationsManagerId; } public void setOperationsManagerId(UUID operationsManagerId) { this.operationsManagerId = operationsManagerId; }
    public UUID getOperationsManagerAccountId() { return operationsManagerAccountId; } public void setOperationsManagerAccountId(UUID operationsManagerAccountId) { this.operationsManagerAccountId = operationsManagerAccountId; }
    public AssignmentStatus getAssignmentStatus() { return assignmentStatus; } public void setAssignmentStatus(AssignmentStatus assignmentStatus) { this.assignmentStatus = assignmentStatus; }
    public OffsetDateTime getAssignedAt() { return assignedAt; } public void setAssignedAt(OffsetDateTime assignedAt) { this.assignedAt = assignedAt; }
    public UUID getStateId() { return stateId; } public void setStateId(UUID stateId) { this.stateId = stateId; }
    public String getPreviousZoneName() { return previousZoneName; } public void setPreviousZoneName(String previousZoneName) { this.previousZoneName = previousZoneName; }
    public String getPreviousCityName() { return previousCityName; } public void setPreviousCityName(String previousCityName) { this.previousCityName = previousCityName; }
    public OffsetDateTime getLastTransferredAt() { return lastTransferredAt; } public void setLastTransferredAt(OffsetDateTime lastTransferredAt) { this.lastTransferredAt = lastTransferredAt; }
}
