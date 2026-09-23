package com.cbg.lbos.service;

import com.cbg.lbos.dto.VehicleAssignmentDto;
import com.cbg.lbos.entity.AssignmentStatus;
import com.cbg.lbos.entity.Driver;
import com.cbg.lbos.entity.DriverStatus;
import com.cbg.lbos.entity.Vehicle;
import com.cbg.lbos.entity.VehicleAssignment;
import com.cbg.lbos.entity.VehicleStatus;
import com.cbg.lbos.repository.DriverRepository;
import com.cbg.lbos.repository.VehicleAssignmentRepository;
import com.cbg.lbos.repository.VehicleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VehicleAssignmentServiceImplTest {

	@Mock
	private VehicleAssignmentRepository assignmentRepository;
	@Mock
	private VehicleRepository vehicleRepository;
	@Mock
	private DriverRepository driverRepository;

	@InjectMocks
	private VehicleAssignmentServiceImpl service;

	private UUID vehicleId;
	private UUID driverId;
	private UUID fleetOwnerId;
	private UUID userAccountId;

	@BeforeEach
	void setUp() {
		vehicleId = UUID.randomUUID();
		driverId = UUID.randomUUID();
		fleetOwnerId = UUID.randomUUID();
		userAccountId = UUID.randomUUID();
	}

	private VehicleAssignmentDto requestDto() {
		VehicleAssignmentDto dto = new VehicleAssignmentDto();
		dto.setVehicleId(vehicleId);
		dto.setDriverId(driverId);
		dto.setAssignedByAccountId(UUID.randomUUID());
		return dto;
	}

	private Vehicle vehicle(VehicleStatus status, UUID owner) {
		Vehicle vehicleEntity = new Vehicle();
		vehicleEntity.setVehicleId(vehicleId);
		vehicleEntity.setFleetOwnerId(owner);
		vehicleEntity.setVehicleStatus(status);
		vehicleEntity.setRegistrationNumber("KA05MH1234");
		return vehicleEntity;
	}

	private Driver driver(DriverStatus status, UUID owner) {
		return driver(status, owner, LocalDate.now().plusYears(1));
	}

	private Driver driver(DriverStatus status, UUID owner, LocalDate licenseExpiryDate) {
		Driver driverEntity = new Driver();
		driverEntity.setDriverId(driverId);
		driverEntity.setFleetOwnerId(owner);
		driverEntity.setUserAccountId(userAccountId);
		driverEntity.setDriverStatus(status);
		driverEntity.setLicenseNumber("KA01AB1234");
		driverEntity.setLicenseExpiryDate(licenseExpiryDate);
		return driverEntity;
	}

	@Test
	void createSavesActiveAssignmentWhenEverythingIsValid() {
		when(vehicleRepository.findById(vehicleId)).thenReturn(Optional.of(vehicle(VehicleStatus.ACTIVE, fleetOwnerId)));
		when(driverRepository.findById(driverId)).thenReturn(Optional.of(driver(DriverStatus.ACTIVE, fleetOwnerId)));
		when(assignmentRepository.existsByVehicleIdAndAssignmentStatus(vehicleId, AssignmentStatus.ACTIVE))
				.thenReturn(false);
		when(assignmentRepository.existsByDriverIdAndAssignmentStatus(driverId, AssignmentStatus.ACTIVE))
				.thenReturn(false);
		when(assignmentRepository.save(any(VehicleAssignment.class))).thenAnswer(invocation -> invocation.getArgument(0));

		VehicleAssignmentDto result = service.create(requestDto());

		ArgumentCaptor<VehicleAssignment> captor = ArgumentCaptor.forClass(VehicleAssignment.class);
		verify(assignmentRepository).save(captor.capture());
		VehicleAssignment saved = captor.getValue();
		assertEquals(vehicleId, saved.getVehicleId());
		assertEquals(driverId, saved.getDriverId());
		assertEquals(AssignmentStatus.ACTIVE, saved.getAssignmentStatus());
		assertEquals(AssignmentStatus.ACTIVE, result.getAssignmentStatus());
	}

	@Test
	void createRejectsWhenVehicleIsMissing() {
		when(vehicleRepository.findById(vehicleId)).thenReturn(Optional.empty());

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.create(requestDto()));

		assertEquals("Vehicle not found", ex.getMessage());
		verify(assignmentRepository, never()).save(any(VehicleAssignment.class));
	}

	@Test
	void createRejectsWhenDriverIsMissing() {
		when(vehicleRepository.findById(vehicleId)).thenReturn(Optional.of(vehicle(VehicleStatus.ACTIVE, fleetOwnerId)));
		when(driverRepository.findById(driverId)).thenReturn(Optional.empty());

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.create(requestDto()));

		assertEquals("Driver not found", ex.getMessage());
	}

	@Test
	void createRejectsWhenTheDriversLicenseHasExpired() {
		when(vehicleRepository.findById(vehicleId)).thenReturn(Optional.of(vehicle(VehicleStatus.ACTIVE, fleetOwnerId)));
		when(driverRepository.findById(driverId))
				.thenReturn(Optional.of(driver(DriverStatus.ACTIVE, fleetOwnerId, LocalDate.now().minusDays(1))));

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.create(requestDto()));

		assertEquals("Driver license has expired", ex.getMessage());
		verify(assignmentRepository, never()).save(any(VehicleAssignment.class));
	}

	@Test
	void createRejectsWhenTheDriverHasNoLicenseExpiryOnRecord() {
		when(vehicleRepository.findById(vehicleId)).thenReturn(Optional.of(vehicle(VehicleStatus.ACTIVE, fleetOwnerId)));
		when(driverRepository.findById(driverId))
				.thenReturn(Optional.of(driver(DriverStatus.ACTIVE, fleetOwnerId, null)));

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.create(requestDto()));

		assertEquals("Driver license has expired", ex.getMessage());
	}

	@Test
	void createRejectsWhenVehicleIsNotActive() {
		when(vehicleRepository.findById(vehicleId))
				.thenReturn(Optional.of(vehicle(VehicleStatus.MAINTENANCE, fleetOwnerId)));
		when(driverRepository.findById(driverId)).thenReturn(Optional.of(driver(DriverStatus.ACTIVE, fleetOwnerId)));

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.create(requestDto()));

		assertEquals("Driver and vehicle must be active", ex.getMessage());
	}

	@Test
	void createRejectsWhenDriverIsNotActive() {
		when(vehicleRepository.findById(vehicleId)).thenReturn(Optional.of(vehicle(VehicleStatus.ACTIVE, fleetOwnerId)));
		when(driverRepository.findById(driverId)).thenReturn(Optional.of(driver(DriverStatus.SUSPENDED, fleetOwnerId)));

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.create(requestDto()));

		assertEquals("Driver and vehicle must be active", ex.getMessage());
	}

	@Test
	void createRejectsWhenVehicleAndDriverBelongToDifferentFleetOwners() {
		when(vehicleRepository.findById(vehicleId)).thenReturn(Optional.of(vehicle(VehicleStatus.ACTIVE, fleetOwnerId)));
		when(driverRepository.findById(driverId))
				.thenReturn(Optional.of(driver(DriverStatus.ACTIVE, UUID.randomUUID())));

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.create(requestDto()));

		assertEquals("Different fleet owners", ex.getMessage());
		verify(assignmentRepository, never()).save(any(VehicleAssignment.class));
	}

	@Test
	void createRejectsWhenVehicleAlreadyHasAnActiveAssignment() {
		when(vehicleRepository.findById(vehicleId)).thenReturn(Optional.of(vehicle(VehicleStatus.ACTIVE, fleetOwnerId)));
		when(driverRepository.findById(driverId)).thenReturn(Optional.of(driver(DriverStatus.ACTIVE, fleetOwnerId)));
		when(assignmentRepository.existsByVehicleIdAndAssignmentStatus(vehicleId, AssignmentStatus.ACTIVE))
				.thenReturn(true);

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.create(requestDto()));

		assertEquals("Active assignment exists", ex.getMessage());
		verify(assignmentRepository, never()).save(any(VehicleAssignment.class));
	}

	@Test
	void createRejectsWhenDriverAlreadyHasAnActiveAssignment() {
		when(vehicleRepository.findById(vehicleId)).thenReturn(Optional.of(vehicle(VehicleStatus.ACTIVE, fleetOwnerId)));
		when(driverRepository.findById(driverId)).thenReturn(Optional.of(driver(DriverStatus.ACTIVE, fleetOwnerId)));
		when(assignmentRepository.existsByVehicleIdAndAssignmentStatus(vehicleId, AssignmentStatus.ACTIVE))
				.thenReturn(false);
		when(assignmentRepository.existsByDriverIdAndAssignmentStatus(driverId, AssignmentStatus.ACTIVE))
				.thenReturn(true);

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.create(requestDto()));

		assertEquals("Active assignment exists", ex.getMessage());
		verify(assignmentRepository, never()).save(any(VehicleAssignment.class));
	}

	@Test
	void endMarksAssignmentEndedAndStampsEndedAt() {
		UUID id = UUID.randomUUID();
		VehicleAssignment existing = new VehicleAssignment();
		existing.setVehicleAssignmentId(id);
		existing.setVehicleId(vehicleId);
		existing.setDriverId(driverId);
		existing.setAssignmentStatus(AssignmentStatus.ACTIVE);
		existing.setAssignedAt(LocalDateTime.now().minusDays(2));
		when(assignmentRepository.findById(id)).thenReturn(Optional.of(existing));
		when(assignmentRepository.save(any(VehicleAssignment.class))).thenAnswer(invocation -> invocation.getArgument(0));

		LocalDateTime before = LocalDateTime.now().minusSeconds(1);
		VehicleAssignmentDto result = service.end(id);

		assertEquals(AssignmentStatus.ENDED, result.getAssignmentStatus());
		assertNotNull(result.getEndedAt());
		assertTrue(result.getEndedAt().isAfter(before));
		assertEquals(AssignmentStatus.ENDED, existing.getAssignmentStatus());
		verify(assignmentRepository).save(existing);
	}

	@Test
	void endThrowsWhenAssignmentIsMissing() {
		UUID id = UUID.randomUUID();
		when(assignmentRepository.findById(id)).thenReturn(Optional.empty());

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.end(id));

		assertEquals("Assignment not found", ex.getMessage());
	}

	@Test
	void activeReturnsMappedActiveAssignments() {
		VehicleAssignment activeAssignment = new VehicleAssignment();
		activeAssignment.setVehicleAssignmentId(UUID.randomUUID());
		activeAssignment.setAssignmentStatus(AssignmentStatus.ACTIVE);
		when(assignmentRepository.findByAssignmentStatus(AssignmentStatus.ACTIVE)).thenReturn(List.of(activeAssignment));

		List<VehicleAssignmentDto> result = service.active();

		assertEquals(1, result.size());
		assertEquals(AssignmentStatus.ACTIVE, result.get(0).getAssignmentStatus());
	}

	@Test
	void getAllMapsEveryAssignment() {
		VehicleAssignment assignmentOne = new VehicleAssignment();
		assignmentOne.setVehicleAssignmentId(UUID.randomUUID());
		VehicleAssignment assignmentTwo = new VehicleAssignment();
		assignmentTwo.setVehicleAssignmentId(UUID.randomUUID());
		when(assignmentRepository.findAll()).thenReturn(List.of(assignmentOne, assignmentTwo));

		assertEquals(2, service.getAll().size());
	}

	@Test
	void deleteRemovesTheLoadedAssignment() {
		UUID id = UUID.randomUUID();
		VehicleAssignment existing = new VehicleAssignment();
		existing.setVehicleAssignmentId(id);
		when(assignmentRepository.findById(id)).thenReturn(Optional.of(existing));

		service.delete(id);

		verify(assignmentRepository).delete(existing);
	}
}
