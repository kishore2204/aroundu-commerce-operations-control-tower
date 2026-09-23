package com.cbg.lbos.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** Indexed on fleet_owner_id - the FK behind DriverRepository.findByFleetOwnerId(), used to
 *  render one fleet owner's driver list/count without a full table scan. */
@Entity
@Table(name = "driver", indexes = @Index(name = "idx_driver_fleet_owner_id", columnList = "fleet_owner_id"))
public class Driver {
	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID driverId;
	private UUID fleetOwnerId;
	@Column(nullable = false, unique = true)
	private UUID userAccountId;
	private UUID cityId;
	private UUID verifiedByAccountId;
	@Column(nullable = false, unique = true)
	private String licenseNumber;
	private LocalDate licenseExpiryDate;
	@Enumerated(EnumType.STRING)
	private DriverStatus driverStatus = DriverStatus.PENDING;
	/*
	 * Nullable - most existing/seeded rows have no location yet. Used by
	 * DriverServiceImpl.nearestAvailable() (haversine distance) - see the matching note on
	 * Vehicle.latitude/longitude.
	 */
	private BigDecimal latitude;
	private BigDecimal longitude;
	/*
	 * Share of the delivery charge this driver keeps per completed trip - nullable, since
	 * existing/seeded drivers predate this column; DriverEarningsSupport (S4) falls back to a
	 * documented default when null rather than treating it as a data error. There is no bank/
	 * payout-account modeling anywhere in this codebase (see the escrow-split work), so this
	 * field only powers earnings *display*, not an actual payout mechanism.
	 */
	private BigDecimal commissionPercent;

	public Driver() {
	}

	public UUID getDriverId() {
		return driverId;
	}

	public void setDriverId(UUID driverId) {
		this.driverId = driverId;
	}

	public UUID getFleetOwnerId() {
		return fleetOwnerId;
	}

	public void setFleetOwnerId(UUID fleetOwnerId) {
		this.fleetOwnerId = fleetOwnerId;
	}

	public UUID getUserAccountId() {
		return userAccountId;
	}

	public void setUserAccountId(UUID userAccountId) {
		this.userAccountId = userAccountId;
	}

	public UUID getCityId() {
		return cityId;
	}

	public void setCityId(UUID cityId) {
		this.cityId = cityId;
	}

	public UUID getVerifiedByAccountId() {
		return verifiedByAccountId;
	}

	public void setVerifiedByAccountId(UUID verifiedByAccountId) {
		this.verifiedByAccountId = verifiedByAccountId;
	}

	public String getLicenseNumber() {
		return licenseNumber;
	}

	public void setLicenseNumber(String licenseNumber) {
		this.licenseNumber = licenseNumber;
	}

	public LocalDate getLicenseExpiryDate() {
		return licenseExpiryDate;
	}

	public void setLicenseExpiryDate(LocalDate licenseExpiryDate) {
		this.licenseExpiryDate = licenseExpiryDate;
	}

	public DriverStatus getDriverStatus() {
		return driverStatus;
	}

	public void setDriverStatus(DriverStatus driverStatus) {
		this.driverStatus = driverStatus;
	}

	public BigDecimal getLatitude() {
		return latitude;
	}

	public void setLatitude(BigDecimal latitude) {
		this.latitude = latitude;
	}

	public BigDecimal getLongitude() {
		return longitude;
	}

	public void setLongitude(BigDecimal longitude) {
		this.longitude = longitude;
	}

	public BigDecimal getCommissionPercent() {
		return commissionPercent;
	}

	public void setCommissionPercent(BigDecimal commissionPercent) {
		this.commissionPercent = commissionPercent;
	}
}
