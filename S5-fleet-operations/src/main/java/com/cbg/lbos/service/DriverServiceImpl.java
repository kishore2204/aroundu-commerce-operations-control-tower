package com.cbg.lbos.service;

import com.cbg.lbos.dto.*;
import com.cbg.lbos.entity.*;
import com.cbg.lbos.repository.*;
import com.cbg.lbos.client.S2PartnerClient;
import com.cbg.lbos.client.S2VerificationSubmissionClient;
import com.cbg.lbos.exception.BadRequestException;
import com.cbg.lbos.exception.ConflictException;
import com.cbg.lbos.exception.DuplicateResourceException;
import com.cbg.lbos.exception.ResourceNotFoundException;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.time.*;

@Service
public class DriverServiceImpl implements DriverService {
	private final DriverRepository driverRepository;
	private final VehicleAssignmentRepository assignmentRepository;
	private final S2PartnerClient partnerClient;
	private final S2VerificationSubmissionClient verificationSubmissionClient;
	private final com.cbg.lbos.client.S1PlatformClient s1PlatformClient;

	public DriverServiceImpl(DriverRepository driverRepository, VehicleAssignmentRepository assignmentRepository,
			S2PartnerClient partnerClient, S2VerificationSubmissionClient verificationSubmissionClient,
			com.cbg.lbos.client.S1PlatformClient s1PlatformClient) {
		this.driverRepository = driverRepository;
		this.assignmentRepository = assignmentRepository;
		this.partnerClient = partnerClient;
		this.verificationSubmissionClient = verificationSubmissionClient;
		this.s1PlatformClient = s1PlatformClient;
	}

	@Transactional
	public DriverDto create(DriverDto driverDto) {
		// the licence is checked FIRST: nothing (not even the driver's login account) is created for an invalid one
		String licenseNumber = com.cbg.lbos.validation.FleetIdentifierRules.requireValidLicence(driverDto.getLicenseNumber());
		FleetOwnerValidationDto fleetOwnerValidation = partnerClient.validateFleetOwner(driverDto.getFleetOwnerId());
		if (!"VERIFIED".equalsIgnoreCase(fleetOwnerValidation.getProfileStatus())
				|| !"ACTIVE".equalsIgnoreCase(fleetOwnerValidation.getOwnerStatus()))
			throw new BadRequestException("Fleet owner is not active and verified in S2");
		if (driverDto.getLicenseExpiryDate() == null || !driverDto.getLicenseExpiryDate().isAfter(LocalDate.now()))
			throw new ConflictException("Driver license expired");

		if (driverDto.getUserAccountId() == null) {
			String email = driverDto.getEmail() != null && !driverDto.getEmail().isBlank()
					? driverDto.getEmail().trim()
					: "driver_" + System.currentTimeMillis() + "@aroundu.com";
			String password = driverDto.getPassword() != null && !driverDto.getPassword().isBlank()
					? driverDto.getPassword()
					: "Driver@123";
			String fName = driverDto.getFirstName() != null && !driverDto.getFirstName().isBlank()
					? driverDto.getFirstName().trim()
					: "Driver";
			String lName = driverDto.getLastName() != null && !driverDto.getLastName().isBlank()
					? driverDto.getLastName().trim()
					: "Partner";
			String phone = "999" + String.format("%07d", new java.util.Random().nextInt(10000000));

			var accountResp = s1PlatformClient.createUserAccount(new com.cbg.lbos.client.S1PlatformClient.CreateUserAccountRequest(
					email, phone, password, fName, lName, "DRIVER", "PENDING_VERIFICATION"
			));
			driverDto.setUserAccountId(accountResp.id());
			driverDto.setEmail(email);
			driverDto.setPassword(password);
			driverDto.setFirstName(fName);
			driverDto.setLastName(lName);
		}

		if (driverRepository.existsByLicenseNumber(licenseNumber)
				|| driverRepository.existsByUserAccountId(driverDto.getUserAccountId()))
			throw new DuplicateResourceException("Driver exists");
		Driver driver = new Driver();
		BeanUtils.copyProperties(driverDto, driver);
		driver.setLicenseNumber(licenseNumber);
		driver.setDriverStatus(DriverStatus.INACTIVE);
		Driver saved = driverRepository.save(driver);
		DriverDto mapped = map(saved);
		mapped.setEmail(driverDto.getEmail());
		mapped.setPassword(driverDto.getPassword());
		mapped.setFirstName(driverDto.getFirstName());
		mapped.setLastName(driverDto.getLastName());
		return mapped;
	}


	@Transactional(readOnly = true)
	public DriverDto get(UUID id) {
		return map(find(id));
	}

	@Transactional(readOnly = true)
	public DriverDto getByUserAccountId(UUID userAccountId) {
		Driver driver = driverRepository.findByUserAccountId(userAccountId)
				.orElseThrow(() -> new ResourceNotFoundException("Driver not found for userAccountId: " + userAccountId));
		return map(driver);
	}


	@Transactional(readOnly = true)
	public List<DriverDto> getAll() {
		List<DriverDto> driverDtos = new ArrayList<>();
		for (Driver driver : driverRepository.findAll())
			driverDtos.add(map(driver));
		return driverDtos;
	}

	@Transactional(readOnly = true)
	public List<DriverDto> getByFleetOwner(UUID fleetOwnerId) {
		List<DriverDto> driverDtos = new ArrayList<>();
		for (Driver driver : driverRepository.findByFleetOwnerId(fleetOwnerId))
			driverDtos.add(map(driver));
		return driverDtos;
	}

	@Transactional(readOnly = true)
	public List<DriverDto> available() {
		List<DriverDto> driverDtos = new ArrayList<>();
		for (Driver driver : driverRepository.findByDriverStatus(DriverStatus.ACTIVE))
			if (!assignmentRepository.existsByDriverIdAndAssignmentStatus(driver.getDriverId(),
					AssignmentStatus.ACTIVE))
				driverDtos.add(map(driver));
		return driverDtos;
	}

	@Transactional(readOnly = true)
	public List<DriverDto> nearestAvailable(java.math.BigDecimal lat, java.math.BigDecimal lon, Double maxKm) {
		List<Driver> active = driverRepository.findByDriverStatus(DriverStatus.ACTIVE);
		java.util.Comparator<Driver> byDistance = java.util.Comparator.comparingDouble(
				driver -> com.cbg.lbos.util.HaversineDistance.km(lat, lon, driver.getLatitude(), driver.getLongitude()));
		List<DriverDto> result = new ArrayList<>();
		for (Driver driver : active.stream().sorted(byDistance).toList()) {
			if (assignmentRepository.existsByDriverIdAndAssignmentStatus(driver.getDriverId(), AssignmentStatus.ACTIVE)) {
				continue;
			}
			double distanceKm = com.cbg.lbos.util.HaversineDistance.km(lat, lon, driver.getLatitude(), driver.getLongitude());
			if (maxKm != null && distanceKm > maxKm) {
				continue;
			}
			result.add(map(driver));
		}
		return result;
	}

	@Transactional
	public DriverDto changeStatus(UUID id, DriverStatus driverStatus) {
		Driver driver = find(id);
		driver.setDriverStatus(driverStatus);
		Driver saved = driverRepository.save(driver);
		if (saved.getUserAccountId() != null && driverStatus == DriverStatus.SUSPENDED) {
			try { s1PlatformClient.updateAccountStatus(saved.getUserAccountId(), java.util.Map.of("accountStatus", "SUSPENDED")); } catch (Exception ignored) {}
		}
		return map(saved);
	}

	/*
	 * Service-to-service only (called from InternalFleetController by S2 once a DRIVER
	 * verification-queue entry is APPROVED) - a direct status flip, no accountId to stamp since
	 * there's no human caller. Deliberately not reusing changeStatus(), which is the JWT-facing
	 * method and expects a real caller-driven target status rather than a fixed ACTIVE outcome.
	 */
	@Transactional
	public DriverDto activate(UUID id) {
		Driver driver = find(id);
		driver.setDriverStatus(DriverStatus.ACTIVE);
		Driver saved = driverRepository.save(driver);
		if (saved.getUserAccountId() != null) {
			s1PlatformClient.updateAccountStatus(saved.getUserAccountId(), java.util.Map.of("accountStatus", "ACTIVE"));
		}
		return map(saved);
	}

	/*
	 * Submits an INACTIVE driver's documents into S2's existing VerificationQueue/
	 * VerificationDocument machinery - the same process already used for Retailer/FleetOwner
	 * onboarding. Only allowed from INACTIVE: ACTIVE means already verified, anything else
	 * means a review is already in flight or the driver isn't eligible.
	 */
	@Transactional
	public UUID submitForVerification(UUID id, UUID submittedByAccountId) {
		Driver driver = find(id);
		if (driver.getDriverStatus() != DriverStatus.INACTIVE)
			throw new ConflictException("Driver must be INACTIVE to submit for verification, was: " + driver.getDriverStatus());

		/*
		 * The queue needs a zoneId to be dispatchable to a Location Manager later (see S2's
		 * VerificationQueueServiceImpl.submitForVerification) - a Driver has no zone of its own,
		 * so it's the owning Fleet Owner's zone, fetched fresh here rather than cached anywhere.
		 */
		FleetOwnerValidationDto fleetOwnerValidation = partnerClient.validateFleetOwner(driver.getFleetOwnerId());
		S2VerificationSubmissionClient.CreateVerificationQueueResponse response = verificationSubmissionClient
				.submitForVerification(new S2VerificationSubmissionClient.CreateVerificationQueueRequest(
						"DRIVER", id, submittedByAccountId, fleetOwnerValidation.getZoneId()));
		return response.verificationQueueId();
	}

	@Transactional
	public DriverDto updateLicense(UUID id, String licenseNumber, java.time.LocalDate licenseExpiryDate) {
		Driver driver = find(id);
		if (licenseNumber != null && !licenseNumber.isBlank()) {
			// Only a CHANGED licence is checked against the format: a driver saving their profile (the screen resends the
			// current value) must not be blocked by a licence that was stored before the rule existed.
			String normalized = com.cbg.lbos.validation.FleetIdentifierRules.normalize(licenseNumber);
			if (normalized != null && !normalized.equals(driver.getLicenseNumber())) {
				normalized = com.cbg.lbos.validation.FleetIdentifierRules.requireValidLicence(normalized);
				if (driverRepository.existsByLicenseNumber(normalized))
					throw new DuplicateResourceException("Driver exists");
				driver.setLicenseNumber(normalized);
			}
		}
		if (licenseExpiryDate != null) {
			if (!licenseExpiryDate.isAfter(java.time.LocalDate.now()))
				throw new ConflictException("Driver license expired");
			driver.setLicenseExpiryDate(licenseExpiryDate);
		}
		return map(driverRepository.save(driver));
	}

	@Transactional
	public void delete(UUID id) {
		driverRepository.delete(find(id));
	}

	private Driver find(UUID id) {
		return driverRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Driver not found"));
	}

	/*
	 * The Driver entity itself has no firstName/lastName/email columns - those live on S1's
	 * UserAccount (see DriverServiceImpl.create(), which only echoes them back in its own
	 * response, never persists them here). Every other listing (GET /api/drivers/mine, /{id},
	 * /me) returned them as null, which is why the fleet drivers table always showed "Unnamed
	 * Driver" regardless of what name was entered when adding the driver. Best-effort, quiet
	 * lookup - same posture as OrderItemService's product/retailer/customer enrichment: a
	 * downed S1 or an orphaned userAccountId leaves the name blank rather than failing the list.
	 */
	private DriverDto map(Driver driver) {
		DriverDto driverDto = new DriverDto();
		BeanUtils.copyProperties(driver, driverDto);
		if (driver.getUserAccountId() != null) {
			try {
				var account = s1PlatformClient.getUserAccount(driver.getUserAccountId());
				if (account != null) {
					driverDto.setFirstName(account.firstName());
					driverDto.setLastName(account.lastName());
					driverDto.setEmail(account.email());
				}
			} catch (Exception ignored) {
			}
		}
		return driverDto;
	}
}
