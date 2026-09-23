package com.cbg.lbos.dto;

import java.math.BigDecimal;
import java.util.UUID;

public class FleetDashboardStatsDto {
    private UUID fleetOwnerId;
    private long totalDrivers;
    private long activeDrivers;
    private long totalVehicles;
    private long activeVehicles;
    private long activeAssignments;
    private BigDecimal totalExpenses;

    public FleetDashboardStatsDto() {
    }

    public UUID getFleetOwnerId() {
        return fleetOwnerId;
    }

    public void setFleetOwnerId(UUID fleetOwnerId) {
        this.fleetOwnerId = fleetOwnerId;
    }

    public long getTotalDrivers() {
        return totalDrivers;
    }

    public void setTotalDrivers(long totalDrivers) {
        this.totalDrivers = totalDrivers;
    }

    public long getActiveDrivers() {
        return activeDrivers;
    }

    public void setActiveDrivers(long activeDrivers) {
        this.activeDrivers = activeDrivers;
    }

    public long getTotalVehicles() {
        return totalVehicles;
    }

    public void setTotalVehicles(long totalVehicles) {
        this.totalVehicles = totalVehicles;
    }

    public long getActiveVehicles() {
        return activeVehicles;
    }

    public void setActiveVehicles(long activeVehicles) {
        this.activeVehicles = activeVehicles;
    }

    public long getActiveAssignments() {
        return activeAssignments;
    }

    public void setActiveAssignments(long activeAssignments) {
        this.activeAssignments = activeAssignments;
    }

    public BigDecimal getTotalExpenses() {
        return totalExpenses;
    }

    public void setTotalExpenses(BigDecimal totalExpenses) {
        this.totalExpenses = totalExpenses;
    }
}
