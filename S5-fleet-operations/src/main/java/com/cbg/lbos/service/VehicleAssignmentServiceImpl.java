package com.cbg.lbos.service;

import com.cbg.lbos.dto.*;
import com.cbg.lbos.entity.*;
import com.cbg.lbos.repository.*;
import com.cbg.lbos.exception.BadRequestException;
import com.cbg.lbos.exception.ConflictException;
import com.cbg.lbos.exception.ResourceNotFoundException;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.time.*;
import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class VehicleAssignmentServiceImpl implements VehicleAssignmentService {
	private final VehicleAssignmentRepository assignmentRepository;
	private final VehicleRepository vehicleRepository;
	private final DriverRepository driverRepository;

	public VehicleAssignmentServiceImpl(VehicleAssignmentRepository assignmentRepository,
			VehicleRepository vehicleRepository, DriverRepository driverRepository) {
		this.assignmentRepository = assignmentRepository;
		this.vehicleRepository = vehicleRepository;
		this.driverRepository = driverRepository;
	}

	/*
	 * Driver eligibility used to be re-checked against S2 (partnerClient.
	 * validateDriverByUserAccount(...)), but S2 has no driver domain at all - that call
	 * always targeted a nonexistent endpoint. Everything this method needs to know about the
	 * driver's eligibility (active status, license expiry) is already stored locally on the
	 * Driver entity that was just loaded, so it's checked directly instead.
	 */
	@Transactional
	public VehicleAssignmentDto create(VehicleAssignmentDto assignmentDto) {
		Vehicle vehicle = vehicleRepository.findById(assignmentDto.getVehicleId())
				.orElseThrow(() -> new ResourceNotFoundException("Vehicle not found"));
		Driver driver = driverRepository.findById(assignmentDto.getDriverId())
				.orElseThrow(() -> new ResourceNotFoundException("Driver not found"));
		if (driver.getLicenseExpiryDate() == null || !driver.getLicenseExpiryDate().isAfter(LocalDate.now()))
			throw new ConflictException("Driver license has expired");
		if (vehicle.getVehicleStatus() != VehicleStatus.ACTIVE || driver.getDriverStatus() != DriverStatus.ACTIVE)
			throw new ConflictException("Driver and vehicle must be active");
		if (!Objects.equals(vehicle.getFleetOwnerId(), driver.getFleetOwnerId()))
			throw new BadRequestException("Different fleet owners");
		if (assignmentDto.getCargoWeightKg() != null
				&& !(vehicle.getCapacityKg() != null
						&& vehicle.getCapacityKg().compareTo(assignmentDto.getCargoWeightKg()) >= 0))
			throw new ConflictException("Vehicle capacity (" + vehicle.getCapacityKg()
					+ "kg) is insufficient for required cargo weight (" + assignmentDto.getCargoWeightKg() + "kg)");
		if (assignmentDto.getRequiredVehicleType() != null && !assignmentDto.getRequiredVehicleType().isBlank()
				&& !(vehicle.getVehicleType() != null
						&& vehicle.getVehicleType().equalsIgnoreCase(assignmentDto.getRequiredVehicleType())))
			throw new BadRequestException("Vehicle type " + vehicle.getVehicleType() + " does not match required type "
					+ assignmentDto.getRequiredVehicleType());
		if (assignmentRepository.existsByVehicleIdAndAssignmentStatus(assignmentDto.getVehicleId(),
				AssignmentStatus.ACTIVE)
				|| assignmentRepository.existsByDriverIdAndAssignmentStatus(assignmentDto.getDriverId(),
						AssignmentStatus.ACTIVE))
			throw new ConflictException("Active assignment exists");
		VehicleAssignment assignment = new VehicleAssignment();
		BeanUtils.copyProperties(assignmentDto, assignment);
		assignment.setAssignmentStatus(AssignmentStatus.ACTIVE);
		return map(assignmentRepository.save(assignment));
	}

	@Transactional(readOnly = true)
	public VehicleAssignmentDto get(UUID id) {
		return map(find(id));
	}

	@Transactional(readOnly = true)
	public List<VehicleAssignmentDto> getAll() {
		return list(assignmentRepository.findAll());
	}

	@Transactional(readOnly = true)
	public List<VehicleAssignmentDto> getByFleetOwner(UUID fleetOwnerId) {
		List<UUID> vehicleIds = vehicleRepository.findByFleetOwnerId(fleetOwnerId).stream()
				.map(Vehicle::getVehicleId)
				.toList();
		if (vehicleIds.isEmpty())
			return List.of();
		return list(assignmentRepository.findByVehicleIdIn(vehicleIds));
	}

	@Transactional(readOnly = true)
	public List<VehicleAssignmentDto> active() {
		return list(assignmentRepository.findByAssignmentStatus(AssignmentStatus.ACTIVE));
	}

	@Transactional
	public VehicleAssignmentDto end(UUID id) {
		VehicleAssignment assignment = find(id);
		assignment.setAssignmentStatus(AssignmentStatus.ENDED);
		assignment.setEndedAt(LocalDateTime.now());
		return map(assignmentRepository.save(assignment));
	}

	@Transactional
	public void delete(UUID id) {
		assignmentRepository.delete(find(id));
	}

	/*
	 * A low average assignment duration across several ended assignments suggests something's
	 * wrong (frequent reassignment, unreliable pairing, etc). Assignments shorter than a week
	 * (168 hours) on average, with enough of a sample to be meaningful, are flagged as churn.
	 */
	private static final double HIGH_CHURN_THRESHOLD_HOURS = 168.0;
	private static final long MIN_ASSIGNMENTS_FOR_SIGNAL = 3;

	@Transactional(readOnly = true)
	public AssignmentReliabilityDto reliability(UUID vehicleId, UUID driverId) {
		if (vehicleId == null && driverId == null)
			throw new BadRequestException("Either vehicleId or driverId must be supplied");
		List<VehicleAssignment> assignments;
		if (vehicleId != null && driverId != null) {
			assignments = assignmentRepository.findByVehicleIdAndAssignmentStatus(vehicleId, AssignmentStatus.ENDED);
			assignments.removeIf(assignment -> !Objects.equals(assignment.getDriverId(), driverId));
		} else if (vehicleId != null) {
			assignments = assignmentRepository.findByVehicleIdAndAssignmentStatus(vehicleId, AssignmentStatus.ENDED);
		} else {
			assignments = assignmentRepository.findByDriverIdAndAssignmentStatus(driverId, AssignmentStatus.ENDED);
		}
		List<Double> durationsHours = new ArrayList<>();
		for (VehicleAssignment assignment : assignments) {
			if (assignment.getAssignedAt() != null && assignment.getEndedAt() != null)
				durationsHours.add(Duration.between(assignment.getAssignedAt(), assignment.getEndedAt()).toMinutes() / 60.0);
		}
		long endedAssignmentCount = durationsHours.size();
		BigDecimal averageDurationHours = BigDecimal.ZERO;
		if (endedAssignmentCount > 0) {
			double sum = 0;
			for (double duration : durationsHours)
				sum += duration;
			averageDurationHours = BigDecimal.valueOf(sum / endedAssignmentCount).setScale(2, RoundingMode.HALF_UP);
		}
		String reliabilityFlag;
		if (endedAssignmentCount < MIN_ASSIGNMENTS_FOR_SIGNAL)
			reliabilityFlag = "INSUFFICIENT_DATA";
		else if (averageDurationHours.doubleValue() < HIGH_CHURN_THRESHOLD_HOURS)
			reliabilityFlag = "HIGH_CHURN";
		else
			reliabilityFlag = "STABLE";
		return new AssignmentReliabilityDto(vehicleId, driverId, endedAssignmentCount, averageDurationHours, reliabilityFlag);
	}

	/*
	 * REBALANCE LOADS (operations manager)
	 *
	 * A vehicle/driver can only ever hold one ACTIVE assignment at a time (see the
	 * exclusivity check in create()), so there's no "current load" to redistribute between
	 * already-assigned resources without ending live work - that's out of scope here. What
	 * CAN be balanced is idle capacity: among a fleet owner's currently unassigned (available)
	 * vehicles and drivers, pair up the least-utilized ones first, so future work naturally
	 * flows toward vehicles/drivers that have carried the least load historically instead of
	 * repeatedly reusing the same few. "Load" = total assignment count all-time (ACTIVE +
	 * ENDED), via VehicleAssignmentRepository.countByVehicleId/countByDriverId.
	 */
	@Transactional
	public RebalanceResultDto rebalance(UUID fleetOwnerId) {
		if (fleetOwnerId == null)
			throw new BadRequestException("fleetOwnerId is required");

		List<Vehicle> availableVehicles = vehicleRepository.findByFleetOwnerIdAndVehicleStatus(fleetOwnerId, VehicleStatus.ACTIVE)
				.stream()
				.filter(vehicle -> !assignmentRepository.existsByVehicleIdAndAssignmentStatus(vehicle.getVehicleId(), AssignmentStatus.ACTIVE))
				.sorted(Comparator.comparingLong(vehicle -> assignmentRepository.countByVehicleId(vehicle.getVehicleId())))
				.toList();

		List<Driver> availableDrivers = driverRepository.findByFleetOwnerIdAndDriverStatus(fleetOwnerId, DriverStatus.ACTIVE)
				.stream()
				.filter(driver -> !assignmentRepository.existsByDriverIdAndAssignmentStatus(driver.getDriverId(), AssignmentStatus.ACTIVE))
				.filter(driver -> driver.getLicenseExpiryDate() != null && driver.getLicenseExpiryDate().isAfter(LocalDate.now()))
				.sorted(Comparator.comparingLong(driver -> assignmentRepository.countByDriverId(driver.getDriverId())))
				.toList();

		int pairCount = Math.min(availableVehicles.size(), availableDrivers.size());
		List<RebalanceResultDto.Pairing> pairings = new ArrayList<>();
		for (int i = 0; i < pairCount; i++) {
			Vehicle vehicle = availableVehicles.get(i);
			Driver driver = availableDrivers.get(i);
			long vehiclePriorCount = assignmentRepository.countByVehicleId(vehicle.getVehicleId());
			long driverPriorCount = assignmentRepository.countByDriverId(driver.getDriverId());

			VehicleAssignment assignment = new VehicleAssignment();
			assignment.setVehicleId(vehicle.getVehicleId());
			assignment.setDriverId(driver.getDriverId());
			assignment.setAssignmentStatus(AssignmentStatus.ACTIVE);
			assignmentRepository.save(assignment);

			pairings.add(new RebalanceResultDto.Pairing(vehicle.getVehicleId(), vehiclePriorCount, driver.getDriverId(), driverPriorCount));
		}

		return new RebalanceResultDto(fleetOwnerId, pairings.size(), pairings,
				availableVehicles.size() - pairCount, availableDrivers.size() - pairCount);
	}

	private VehicleAssignment find(UUID id) {
		return assignmentRepository.findById(id)
				.orElseThrow(() -> new ResourceNotFoundException("Assignment not found"));
	}

	private VehicleAssignmentDto map(VehicleAssignment assignment) {
		VehicleAssignmentDto assignmentDto = new VehicleAssignmentDto();
		BeanUtils.copyProperties(assignment, assignmentDto);
		return assignmentDto;
	}

	private List<VehicleAssignmentDto> list(List<VehicleAssignment> assignments) {
		List<VehicleAssignmentDto> assignmentDtos = new ArrayList<>();
		for (VehicleAssignment assignment : assignments)
			assignmentDtos.add(map(assignment));
		return assignmentDtos;
	}
}
