package com.example.lbos.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.UUID;

/**
 * Indexes cover the columns actually filtered/joined on: {@code user_account_id} (GET /api/retailers/me,
 * one lookup per retailer session), {@code city_id}/{@code zone_id}/{@code retailer_status} (the
 * by-city/by-status list endpoints and the Location-Manager zone dashboard), and
 * {@code business_name} (the search endpoint's LIKE-prefix lookup).
 */
@Entity
@Table(name = "retailer", indexes = {
        @Index(name = "idx_retailer_user_account_id", columnList = "user_account_id"),
        @Index(name = "idx_retailer_city_id", columnList = "city_id"),
        @Index(name = "idx_retailer_zone_id", columnList = "zone_id"),
        @Index(name = "idx_retailer_status", columnList = "retailer_status"),
        @Index(name = "idx_retailer_business_name", columnList = "business_name"),
})
public class Retailer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "retailer_id", nullable = false)
    private UUID retailerId;

    @Column(name = "user_account_id", nullable = false)
    private UUID userAccountId;

    @Column(name = "operations_manager_id")
    private UUID operationsManagerId;

    @Column(name = "city_id", nullable = false)
    private UUID cityId;

    /**
     * The zone (a subdivision of the city) this retailer is assigned to for verification
     * routing. A City can have several zones, each with its own Location Manager, so this must
     * be resolved separately from cityId when dispatching a verification request.
     */
    @Column(name = "zone_id")
    private UUID zoneId;

    @Column(name = "longitude", precision = 11, scale = 7)
    private BigDecimal longitude;

    @Column(name = "latitude", precision = 10, scale = 7)
    private BigDecimal latitude;

    @Column(name = "business_name", length = 200, nullable = false)
    private String businessName;

    @Column(name = "registration_number", length = 100)
    private String registrationNumber;

    @Column(name = "gst_number", length = 15)
    private String gstNumber;

    @Column(name = "retailer_status", length = 30, nullable = false)
    private String retailerStatus;

    // columnDefinition (not just nullable=false) so Hibernate's ddl-auto=update ALTER TABLE
    // includes "DEFAULT true" - without it, adding this NOT NULL column ever failed against
    // a real Postgres retailer table that already had rows (confirmed live:
    // "column is_open of relation retailer contains null values").
    @Column(name = "is_open", nullable = false, columnDefinition = "boolean default true")
    private boolean isOpen = true;

    @Column(name = "opens_at")
    private LocalTime opensAt;

    @Column(name = "closes_at")
    private LocalTime closesAt;

    public Retailer() {
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
        this.registrationNumber = registrationNumber;
    }

    public String getGstNumber() {
        return gstNumber;
    }

    public void setGstNumber(String gstNumber) {
        this.gstNumber = gstNumber;
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
