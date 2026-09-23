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
public class VehicleServiceImpl implements VehicleService {
	private final VehicleRepository vehicleRepository;
	private final VehicleAssignmentRepository assignmentRepository;
	private final S2PartnerClient partnerClient;
	private final S2VerificationSubmissionClient verificationSubmissionClient;

	public VehicleServiceImpl(VehicleRepository vehicleRepository, VehicleAssignmentRepository assignmentRepository,
			S2PartnerClient partnerClient, S2VerificationSubmissionClient verificationSubmissionClient) {
		this.vehicleRepository = vehicleRepository;
		this.assignmentRepository = assignmentRepository;
		this.partnerClient = partnerClient;
		this.verificationSubmissionClient = verificationSubmissionClient;
	}

	@Transactional
	public VehicleDto create(VehicleDto vehicleDto) {
		String registrationNumber = com.cbg.lbos.validation.FleetIdentifierRules.requireValidVehicleNumber(vehicleDto.getRegistrationNumber());
		FleetOwnerValidationDto ownerValidation = partnerClient.validateFleetOwner(vehicleDto.getFleetOwnerId());
		/*
		 * Was requiring profileStatus=="ACTIVE" and ownerStatus=="APPROVED" - values S2 never
		 * actually produces (profileStatus is VERIFIED/PENDING, the KYC outcome; ownerStatus is
		 * ACTIVE/INACTIVE/SUSPENDED, the account state), so this rejected every vehicle
		 * creation. Confirmed live against S2's /internal/v1/fleet-owners/{id}/validation:
		 * fleetowner1 returns profileStatus=VERIFIED, ownerStatus=ACTIVE,
		 * verificationStatus=VERIFIED (mirrors profileStatus - see S2's
		 * InternalFleetOwnerController). Matches the check DriverServiceImpl already got right.
		 */
		if (!"VERIFIED".equalsIgnoreCase(ownerValidation.getProfileStatus())
				|| !"ACTIVE".equalsIgnoreCase(ownerValidation.getOwnerStatus())
				|| !"VERIFIED".equalsIgnoreCase(ownerValidation.getVerificationStatus()))
			throw new BadRequestException("Fleet owner is not active, approved and verified in S2");
		if (vehicleRepository.existsByRegistrationNumber(registrationNumber))
			throw new DuplicateResourceException("Registration exists");
		Vehicle vehicle = new Vehicle();
		BeanUtils.copyProperties(vehicleDto, vehicle);
		vehicle.setRegistrationNumber(registrationNumber);
		/*
		 * A newly onboarded vehicle starts INACTIVE, not ACTIVE - it isn't fit for assignment
		 * until its documents clear verification (see the driver/vehicle verification workflow
		 * in VerificationQueueServiceImpl). changeStatus() is what moves it to ACTIVE once approved.
		 */
		vehicle.setVehicleStatus(VehicleStatus.INACTIVE);
		return map(vehicleRepository.save(vehicle));
	}

	@Transactional(readOnly = true)
	public VehicleDto get(UUID id) {
		return map(find(id));
	}

	@Transactional(readOnly = true)
	public List<VehicleDto> getAll() {
		List<VehicleDto> vehicleDtos = new ArrayList<>();
		for (Vehicle vehicle : vehicleRepository.findAll())
			vehicleDtos.add(map(vehicle));
		return vehicleDtos;
	}

	@Transactional(readOnly = true)
	public List<VehicleDto> getByFleetOwner(UUID fleetOwnerId) {
		List<VehicleDto> vehicleDtos = new ArrayList<>();
		for (Vehicle vehicle : vehicleRepository.findByFleetOwnerId(fleetOwnerId))
			vehicleDtos.add(map(vehicle));
		return vehicleDtos;
	}

	@Transactional(readOnly = true)
	public List<VehicleDto> available() {
		List<VehicleDto> vehicleDtos = new ArrayList<>();
		for (Vehicle vehicle : vehicleRepository.findByVehicleStatus(VehicleStatus.ACTIVE))
			if (!assignmentRepository.existsByVehicleIdAndAssignmentStatus(vehicle.getVehicleId(),
					AssignmentStatus.ACTIVE))
				vehicleDtos.add(map(vehicle));
		return vehicleDtos;
	}

	@Transactional(readOnly = true)
	public List<VehicleDto> nearestAvailable(java.math.BigDecimal lat, java.math.BigDecimal lon, Double maxKm) {
		List<Vehicle> active = vehicleRepository.findByVehicleStatus(VehicleStatus.ACTIVE);
		java.util.Comparator<Vehicle> byDistance = java.util.Comparator.comparingDouble(
				vehicle -> com.cbg.lbos.util.HaversineDistance.km(lat, lon, vehicle.getLatitude(), vehicle.getLongitude()));
		List<VehicleDto> result = new ArrayList<>();
		for (Vehicle vehicle : active.stream().sorted(byDistance).toList()) {
			if (assignmentRepository.existsByVehicleIdAndAssignmentStatus(vehicle.getVehicleId(), AssignmentStatus.ACTIVE)) {
				continue;
			}
			double distanceKm = com.cbg.lbos.util.HaversineDistance.km(lat, lon, vehicle.getLatitude(), vehicle.getLongitude());
			if (maxKm != null && distanceKm > maxKm) {
				continue;
			}
			result.add(map(vehicle));
		}
		return result;
	}

	@Transactional
	public VehicleDto changeStatus(UUID id, VehicleStatus vehicleStatus, UUID accountId) {
		Vehicle vehicle = find(id);
		if (vehicleStatus != VehicleStatus.ACTIVE
				&& assignmentRepository.existsByVehicleIdAndAssignmentStatus(id, AssignmentStatus.ACTIVE))
			throw new ConflictException("End active assignment first");
		vehicle.setVehicleStatus(vehicleStatus);
		vehicle.setUpdatedByAccountId(accountId);
		return map(vehicleRepository.save(vehicle));
	}

	/*
	 * Service-to-service only (called from InternalFleetController by S2 once a VEHICLE
	 * verification-queue entry is APPROVED) - a direct status flip, no accountId to stamp since
	 * there's no human caller. Deliberately not reusing changeStatus(), which is the JWT-facing
	 * method, expects a real caller-driven target status, and runs an active-assignment guard
	 * that doesn't apply to a freshly-verified, still-unassigned vehicle.
	 */
	@Transactional
	public VehicleDto activate(UUID id) {
		Vehicle vehicle = find(id);
		vehicle.setVehicleStatus(VehicleStatus.ACTIVE);
		return map(vehicleRepository.save(vehicle));
	}

	/*
	 * Submits an INACTIVE vehicle's documents into S2's existing VerificationQueue/
	 * VerificationDocument machinery - the same process already used for Retailer/FleetOwner
	 * onboarding. Only allowed from INACTIVE: ACTIVE means already verified, anything else
	 * means a review is already in flight or the vehicle isn't eligible.
	 */
	@Transactional
	public UUID submitForVerification(UUID id, UUID submittedByAccountId) {
		Vehicle vehicle = find(id);
		if (vehicle.getVehicleStatus() != VehicleStatus.INACTIVE)
			throw new ConflictException("Vehicle must be INACTIVE to submit for verification, was: " + vehicle.getVehicleStatus());

		/*
		 * The queue needs a zoneId to be dispatchable to a Location Manager later (see S2's
		 * VerificationQueueServiceImpl.submitForVerification) - a Vehicle has no zone of its own,
		 * so it's the owning Fleet Owner's zone, fetched fresh here rather than cached anywhere.
		 */
		FleetOwnerValidationDto fleetOwnerValidation = partnerClient.validateFleetOwner(vehicle.getFleetOwnerId());
		S2VerificationSubmissionClient.CreateVerificationQueueResponse response = verificationSubmissionClient
				.submitForVerification(new S2VerificationSubmissionClient.CreateVerificationQueueRequest(
						"VEHICLE", id, submittedByAccountId, fleetOwnerValidation.getZoneId()));
		return response.verificationQueueId();
	}

	@Transactional
	public void delete(UUID id) {
		vehicleRepository.delete(find(id));
	}

	private Vehicle find(UUID id) {
		return vehicleRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Vehicle not found"));
	}

	private VehicleDto map(Vehicle vehicle) {
		VehicleDto vehicleDto = new VehicleDto();
		BeanUtils.copyProperties(vehicle, vehicleDto);
		return vehicleDto;
	}
}
