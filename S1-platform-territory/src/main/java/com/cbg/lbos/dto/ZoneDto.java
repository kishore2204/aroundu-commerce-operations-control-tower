package com.cbg.lbos.dto;

import java.util.UUID;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class ZoneDto {
    private UUID zoneId;
    @NotNull(message = "City ID is required") private UUID cityId;
    private String cityName;
    private UUID stateId;
    private String stateName;
    @NotBlank(message = "Zone name is required")
    @Size(min = 2, max = 100, message = "Zone name must contain between 2 and 100 characters")
    private String zoneName;
    private Boolean active;
    public UUID getZoneId() { return zoneId; } public void setZoneId(UUID zoneId) { this.zoneId = zoneId; }
    public UUID getCityId() { return cityId; } public void setCityId(UUID cityId) { this.cityId = cityId; }
    public String getCityName() { return cityName; } public void setCityName(String cityName) { this.cityName = cityName; }
    public UUID getStateId() { return stateId; } public void setStateId(UUID stateId) { this.stateId = stateId; }
    public String getStateName() { return stateName; } public void setStateName(String stateName) { this.stateName = stateName; }
    public String getZoneName() { return zoneName; } public void setZoneName(String zoneName) { this.zoneName = zoneName; }
    public Boolean getActive() { return active; } public void setActive(Boolean active) { this.active = active; }
}
