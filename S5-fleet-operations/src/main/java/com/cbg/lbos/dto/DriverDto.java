package com.cbg.lbos.dto;

import com.cbg.lbos.entity.*;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;

public class DriverDto {
	UUID driverId;
	UUID fleetOwnerId;
	UUID userAccountId;
	UUID cityId;
	UUID verifiedByAccountId;
	String licenseNumber;
	LocalDate licenseExpiryDate;
	DriverStatus driverStatus;
	BigDecimal latitude;
	BigDecimal longitude;
	String firstName;
	String lastName;
	String email;
	String password;
	String cityName;
	String licenseDocumentUrl;
	BigDecimal commissionPercent;

	public DriverDto() {
	}

	public String getFirstName() {
		return firstName;
	}

	public void setFirstName(String firstName) {
		this.firstName = firstName;
	}

	public String getLastName() {
		return lastName;
	}

	public void setLastName(String lastName) {
		this.lastName = lastName;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	public String getPassword() {
		return password;
	}

	public void setPassword(String password) {
		this.password = password;
	}

	public String getCityName() {
		return cityName;
	}

	public void setCityName(String cityName) {
		this.cityName = cityName;
	}

	public String getLicenseDocumentUrl() {
		return licenseDocumentUrl;
	}

	public void setLicenseDocumentUrl(String licenseDocumentUrl) {
		this.licenseDocumentUrl = licenseDocumentUrl;
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