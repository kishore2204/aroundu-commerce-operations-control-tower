package com.cbg.lbos.entity;

import java.time.OffsetDateTime;
import java.util.UUID;
import jakarta.persistence.*;

/**
 * Lightweight audit trail of every trip status transition - Trip itself only stores 3
 * timestamps (plannedStartAt/actualStartAt/completedAt), not a full history, so there was
 * previously no timestamped record a driver/fleet-owner/support-agent could point to if a
 * customer disputed what happened and when.
 */
@Entity
@Table(name = "trip_status_history", indexes = @Index(name = "idx_trip_status_history_trip_id", columnList = "trip_id"))
public class TripStatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "trip_status_history_id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(name = "from_status")
    private String fromStatus;

    @Column(name = "to_status", nullable = false)
    private String toStatus;

    @Column(name = "changed_at", nullable = false)
    private OffsetDateTime changedAt;

    @Column(name = "changed_by_account_id")
    private UUID changedByAccountId;

    @PrePersist
    private void onCreate() {
        changedAt = OffsetDateTime.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getTripId() {
        return tripId;
    }

    public void setTripId(UUID tripId) {
        this.tripId = tripId;
    }

    public String getFromStatus() {
        return fromStatus;
    }

    public void setFromStatus(String fromStatus) {
        this.fromStatus = fromStatus;
    }

    public String getToStatus() {
        return toStatus;
    }

    public void setToStatus(String toStatus) {
        this.toStatus = toStatus;
    }

    public OffsetDateTime getChangedAt() {
        return changedAt;
    }

    public UUID getChangedByAccountId() {
        return changedByAccountId;
    }

    public void setChangedByAccountId(UUID changedByAccountId) {
        this.changedByAccountId = changedByAccountId;
    }
}
