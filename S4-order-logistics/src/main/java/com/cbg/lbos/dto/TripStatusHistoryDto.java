package com.cbg.lbos.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public class TripStatusHistoryDto {
    private String fromStatus;
    private String toStatus;
    private OffsetDateTime changedAt;
    private UUID changedByAccountId;

    public TripStatusHistoryDto() {
    }

    public TripStatusHistoryDto(String fromStatus, String toStatus, OffsetDateTime changedAt, UUID changedByAccountId) {
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.changedAt = changedAt;
        this.changedByAccountId = changedByAccountId;
    }

    public String getFromStatus() { return fromStatus; }
    public void setFromStatus(String fromStatus) { this.fromStatus = fromStatus; }
    public String getToStatus() { return toStatus; }
    public void setToStatus(String toStatus) { this.toStatus = toStatus; }
    public OffsetDateTime getChangedAt() { return changedAt; }
    public void setChangedAt(OffsetDateTime changedAt) { this.changedAt = changedAt; }
    public UUID getChangedByAccountId() { return changedByAccountId; }
    public void setChangedByAccountId(UUID changedByAccountId) { this.changedByAccountId = changedByAccountId; }
}
