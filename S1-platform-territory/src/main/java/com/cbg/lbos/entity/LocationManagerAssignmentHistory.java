package com.cbg.lbos.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One row per Location Manager transfer: where the officer was and where they moved to. The
 * {@link LocationManager} row itself only ever holds the CURRENT assignment (one row per account),
 * so without this the previous location is lost the moment a transfer is saved. Zone/city names are
 * copied so the history stays readable even if territory records are renamed later.
 */
@Entity
@Table(name = "location_manager_assignment_history")
public class LocationManagerAssignmentHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "history_id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "location_manager_id", nullable = false)
    private UUID locationManagerId;

    @Column(name = "from_zone_id")
    private UUID fromZoneId;
    @Column(name = "from_zone_name", length = 200)
    private String fromZoneName;
    @Column(name = "from_city_name", length = 200)
    private String fromCityName;
    @Column(name = "from_operations_manager_id")
    private UUID fromOperationsManagerId;
    @Column(name = "from_assigned_at")
    private OffsetDateTime fromAssignedAt;

    @Column(name = "to_zone_id")
    private UUID toZoneId;
    @Column(name = "to_zone_name", length = 200)
    private String toZoneName;
    @Column(name = "to_city_name", length = 200)
    private String toCityName;
    @Column(name = "to_operations_manager_id")
    private UUID toOperationsManagerId;

    @Column(name = "changed_at", nullable = false)
    private OffsetDateTime changedAt;

    public LocationManagerAssignmentHistory() { }

    public UUID getId() { return id; }
    public UUID getLocationManagerId() { return locationManagerId; }
    public void setLocationManagerId(UUID locationManagerId) { this.locationManagerId = locationManagerId; }
    public UUID getFromZoneId() { return fromZoneId; }
    public void setFromZoneId(UUID fromZoneId) { this.fromZoneId = fromZoneId; }
    public String getFromZoneName() { return fromZoneName; }
    public void setFromZoneName(String fromZoneName) { this.fromZoneName = fromZoneName; }
    public String getFromCityName() { return fromCityName; }
    public void setFromCityName(String fromCityName) { this.fromCityName = fromCityName; }
    public UUID getFromOperationsManagerId() { return fromOperationsManagerId; }
    public void setFromOperationsManagerId(UUID fromOperationsManagerId) { this.fromOperationsManagerId = fromOperationsManagerId; }
    public OffsetDateTime getFromAssignedAt() { return fromAssignedAt; }
    public void setFromAssignedAt(OffsetDateTime fromAssignedAt) { this.fromAssignedAt = fromAssignedAt; }
    public UUID getToZoneId() { return toZoneId; }
    public void setToZoneId(UUID toZoneId) { this.toZoneId = toZoneId; }
    public String getToZoneName() { return toZoneName; }
    public void setToZoneName(String toZoneName) { this.toZoneName = toZoneName; }
    public String getToCityName() { return toCityName; }
    public void setToCityName(String toCityName) { this.toCityName = toCityName; }
    public UUID getToOperationsManagerId() { return toOperationsManagerId; }
    public void setToOperationsManagerId(UUID toOperationsManagerId) { this.toOperationsManagerId = toOperationsManagerId; }
    public OffsetDateTime getChangedAt() { return changedAt; }
    public void setChangedAt(OffsetDateTime changedAt) { this.changedAt = changedAt; }
}
