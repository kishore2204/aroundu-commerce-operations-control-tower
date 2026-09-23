package com.example.lbos.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.util.UUID;

/**
 * Indexes cover the columns actually filtered/joined on: {@code user_account_id} (GET
 * /api/fleet-owners/me, one lookup per fleet-owner session), {@code city_id}/{@code zone_id}/
 * {@code owner_status}/{@code profile_status} (the by-city/by-status list endpoints and the
 * Location-Manager zone dashboard), and {@code business_name} (the search endpoint).
 */
@Entity
@Table(name = "fleet_owner", indexes = {
        @Index(name = "idx_fleet_owner_user_account_id", columnList = "user_account_id"),
        @Index(name = "idx_fleet_owner_city_id", columnList = "city_id"),
        @Index(name = "idx_fleet_owner_zone_id", columnList = "zone_id"),
        @Index(name = "idx_fleet_owner_owner_status", columnList = "owner_status"),
        @Index(name = "idx_fleet_owner_profile_status", columnList = "profile_status"),
        @Index(name = "idx_fleet_owner_business_name", columnList = "business_name"),
})
public class FleetOwner {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "fleet_owner_id", nullable = false)
    private UUID fleetOwnerId;

    @Column(name = "user_account_id", nullable = false)
    private UUID userAccountId;

    @Column(name = "operations_manager_id")
    private UUID operationsManagerId;

    @Column(name = "city_id", nullable = false)
    private UUID cityId;

    /**
     * The zone (a subdivision of the city) this fleet owner is assigned to for verification
     * routing. A City can have several zones, each with its own Location Manager, so this must
     * be resolved separately from cityId when dispatching a verification request.
     */
    @Column(name = "zone_id")
    private UUID zoneId;

    @Column(name = "business_name", length = 200)
    private String businessName;

    @Column(name = "bank_verified_by_account_id")
    private UUID bankVerifiedByAccountId;

    @Column(name = "profile_status", length = 30, nullable = false)
    private String profileStatus;

    @Column(name = "owner_status", length = 30, nullable = false)
    private String ownerStatus;

    public FleetOwner() {}

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
