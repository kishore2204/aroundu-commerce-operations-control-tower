package com.cbg.lbos.dto;

import java.util.UUID;

public class FleetOwnerValidationDto {
	private UUID fleetOwnerId;
	private UUID zoneId;
	private String profileStatus;
	private String ownerStatus;
	private String verificationStatus;

	public FleetOwnerValidationDto() {
	}

	public UUID getFleetOwnerId() {
		return fleetOwnerId;
	}

	public void setFleetOwnerId(UUID fleetOwnerId) {
		this.fleetOwnerId = fleetOwnerId;
	}

	public UUID getZoneId() {
		return zoneId;
	}

	public void setZoneId(UUID zoneId) {
		this.zoneId = zoneId;
	}

	public String getProfileStatus() {
		return profileStatus;
	}

	public void setProfileStatus(String profileStatus) {
		this.profileStatus = profileStatus;
	}

	public String getOwnerStatus() {
		return ownerStatus;
	}

	public void setOwnerStatus(String ownerStatus) {
		this.ownerStatus = ownerStatus;
	}

	public String getVerificationStatus() {
		return verificationStatus;
	}

	public void setVerificationStatus(String verificationStatus) {
		this.verificationStatus = verificationStatus;
	}
}