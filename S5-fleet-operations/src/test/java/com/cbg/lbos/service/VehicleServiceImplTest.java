package com.cbg.lbos.service;

import com.cbg.lbos.client.S2PartnerClient;
import com.cbg.lbos.dto.FleetOwnerValidationDto;
import com.cbg.lbos.dto.VehicleDto;
import com.cbg.lbos.entity.AssignmentStatus;
import com.cbg.lbos.entity.Vehicle;
import com.cbg.lbos.entity.VehicleStatus;
import com.cbg.lbos.repository.VehicleAssignmentRepository;
import com.cbg.lbos.repository.VehicleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VehicleServiceImplTest {

	@Mock
	private VehicleRepository vehicleRepository;
	@Mock
	private VehicleAssignmentRepository assignmentRepository;
	@Mock
	private S2PartnerClient s2PartnerClient;

	@InjectMocks
	private VehicleServiceImpl service;

	private UUID fleetOwnerId;

	@BeforeEach
	void setUp() {
		fleetOwnerId = UUID.randomUUID();
	}

	private VehicleDto requestDto(String registrationNumber) {
		VehicleDto dto = new VehicleDto();
		dto.setFleetOwnerId(fleetOwnerId);
		dto.setRegistrationNumber(registrationNumber);
		dto.setVehicleType("TRUCK");
		dto.setMake("Tata");
		dto.setModel("Ace");
		dto.setModelYear(2021);
		dto.setCapacityKg(new BigDecimal("750.00"));
		return dto;
	}

	private FleetOwnerValidationDto owner(String profile, String ownerStatus, String verification) {
		FleetOwnerValidationDto validation = new FleetOwnerValidationDto();
		validation.setFleetOwnerId(fleetOwnerId);
		validation.setProfileStatus(profile);
		validation.setOwnerStatus(ownerStatus);
		validation.setVerificationStatus(verification);
		return validation;
	}

	private void stubSaveEcho() {
		when(vehicleRepository.save(any(Vehicle.class))).thenAnswer(invocation -> invocation.getArgument(0));
	}

	@Test
	void createSavesVehicleAsInactiveWhenFleetOwnerIsApprovedVerifiedAndActive() {
		when(s2PartnerClient.validateFleetOwner(fleetOwnerId)).thenReturn(owner("VERIFIED", "ACTIVE", "VERIFIED"));
		when(vehicleRepository.existsByRegistrationNumber("KA05MH1234")).thenReturn(false);
		stubSaveEcho();

		VehicleDto result = service.create(requestDto("KA05MH1234"));

		ArgumentCaptor<Vehicle> captor = ArgumentCaptor.forClass(Vehicle.class);
		verify(vehicleRepository).save(captor.capture());
		Vehicle saved = captor.getValue();
		assertEquals("KA05MH1234", saved.getRegistrationNumber());
		// A newly onboarded vehicle always starts INACTIVE, regardless of the fleet owner's own
		// verification status - it isn't fit for assignment until the vehicle itself is verified
		// (see VehicleServiceImpl.create() and submitForVerification()/changeStatus()).
		assertEquals(VehicleStatus.INACTIVE, saved.getVehicleStatus());
		assertEquals(fleetOwnerId, saved.getFleetOwnerId());
		assertEquals("TRUCK", saved.getVehicleType());
		assertEquals(VehicleStatus.INACTIVE, result.getVehicleStatus());
	}

	@Test
	void createNormalizesRegistrationNumberByStrippingSpacesAndUpperCasing() {
		when(s2PartnerClient.validateFleetOwner(fleetOwnerId)).thenReturn(owner("VERIFIED", "ACTIVE", "VERIFIED"));
		when(vehicleRepository.existsByRegistrationNumber("KA05MH1234")).thenReturn(false);
		stubSaveEcho();

		VehicleDto result = service.create(requestDto(" ka 05 mh 1234 "));

		assertEquals("KA05MH1234", result.getRegistrationNumber());
		verify(vehicleRepository).existsByRegistrationNumber("KA05MH1234");
	}

	@Test
	void createRejectsWhenFleetOwnerProfileIsInactive() {
		when(s2PartnerClient.validateFleetOwner(fleetOwnerId)).thenReturn(owner("PENDING", "ACTIVE", "VERIFIED"));

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.create(requestDto("KA05MH1234")));

		assertEquals("Fleet owner is not active, approved and verified in S2", ex.getMessage());
		verify(vehicleRepository, never()).save(any(Vehicle.class));
	}

	@Test
	void createRejectsWhenFleetOwnerIsNotApproved() {
		when(s2PartnerClient.validateFleetOwner(fleetOwnerId)).thenReturn(owner("VERIFIED", "SUSPENDED", "VERIFIED"));

		assertThrows(RuntimeException.class, () -> service.create(requestDto("KA05MH1234")));
		verify(vehicleRepository, never()).save(any(Vehicle.class));
	}

	@Test
	void createRejectsWhenFleetOwnerIsNotVerified() {
		when(s2PartnerClient.validateFleetOwner(fleetOwnerId)).thenReturn(owner("VERIFIED", "ACTIVE", "PENDING"));

		assertThrows(RuntimeException.class, () -> service.create(requestDto("KA05MH1234")));
		verify(vehicleRepository, never()).save(any(Vehicle.class));
	}

	@Test
	void createRejectsDuplicateRegistrationNumber() {
		when(s2PartnerClient.validateFleetOwner(fleetOwnerId)).thenReturn(owner("VERIFIED", "ACTIVE", "VERIFIED"));
		when(vehicleRepository.existsByRegistrationNumber("KA05MH1234")).thenReturn(true);

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.create(requestDto("KA05MH1234")));

		assertEquals("Registration exists", ex.getMessage());
		verify(vehicleRepository, never()).save(any(Vehicle.class));
	}

	@Test
	void changeStatusBlocksLeavingActiveWhileAnActiveAssignmentExists() {
		UUID id = UUID.randomUUID();
		Vehicle existing = new Vehicle();
		existing.setVehicleId(id);
		existing.setVehicleStatus(VehicleStatus.ACTIVE);
		when(vehicleRepository.findById(id)).thenReturn(Optional.of(existing));
		when(assignmentRepository.existsByVehicleIdAndAssignmentStatus(id, AssignmentStatus.ACTIVE)).thenReturn(true);

		RuntimeException ex = assertThrows(RuntimeException.class,
				() -> service.changeStatus(id, VehicleStatus.MAINTENANCE, UUID.randomUUID()));

		assertEquals("End active assignment first", ex.getMessage());
		assertEquals(VehicleStatus.ACTIVE, existing.getVehicleStatus());
		verify(vehicleRepository, never()).save(any(Vehicle.class));
	}

	@Test
	void changeStatusAllowsLeavingActiveWhenNoActiveAssignmentExists() {
		UUID id = UUID.randomUUID();
		UUID updatedBy = UUID.randomUUID();
		Vehicle existing = new Vehicle();
		existing.setVehicleId(id);
		existing.setVehicleStatus(VehicleStatus.ACTIVE);
		when(vehicleRepository.findById(id)).thenReturn(Optional.of(existing));
		when(assignmentRepository.existsByVehicleIdAndAssignmentStatus(id, AssignmentStatus.ACTIVE)).thenReturn(false);
		stubSaveEcho();

		VehicleDto result = service.changeStatus(id, VehicleStatus.MAINTENANCE, updatedBy);

		assertEquals(VehicleStatus.MAINTENANCE, result.getVehicleStatus());
		assertEquals(updatedBy, result.getUpdatedByAccountId());
		verify(vehicleRepository).save(existing);
	}

	@Test
	void changeStatusBackToActiveSkipsTheActiveAssignmentCheck() {
		UUID id = UUID.randomUUID();
		UUID updatedBy = UUID.randomUUID();
		Vehicle existing = new Vehicle();
		existing.setVehicleId(id);
		existing.setVehicleStatus(VehicleStatus.MAINTENANCE);
		when(vehicleRepository.findById(id)).thenReturn(Optional.of(existing));
		stubSaveEcho();

		VehicleDto result = service.changeStatus(id, VehicleStatus.ACTIVE, updatedBy);

		assertEquals(VehicleStatus.ACTIVE, result.getVehicleStatus());
		verify(assignmentRepository, never()).existsByVehicleIdAndAssignmentStatus(any(UUID.class),
				any(AssignmentStatus.class));
	}

	@Test
	void availableReturnsOnlyActiveVehiclesWithoutAnActiveAssignment() {
		Vehicle free = new Vehicle();
		free.setVehicleId(UUID.randomUUID());
		free.setRegistrationNumber("FREE1");
		Vehicle busy = new Vehicle();
		busy.setVehicleId(UUID.randomUUID());
		busy.setRegistrationNumber("BUSY1");

		when(vehicleRepository.findByVehicleStatus(VehicleStatus.ACTIVE)).thenReturn(Arrays.asList(free, busy));
		when(assignmentRepository.existsByVehicleIdAndAssignmentStatus(free.getVehicleId(), AssignmentStatus.ACTIVE))
				.thenReturn(false);
		when(assignmentRepository.existsByVehicleIdAndAssignmentStatus(busy.getVehicleId(), AssignmentStatus.ACTIVE))
				.thenReturn(true);

		List<VehicleDto> result = service.available();

		assertEquals(1, result.size());
		assertEquals("FREE1", result.get(0).getRegistrationNumber());
	}

	@Test
	void getThrowsWhenVehicleIsMissing() {
		UUID id = UUID.randomUUID();
		when(vehicleRepository.findById(id)).thenReturn(Optional.empty());

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.get(id));

		assertEquals("Vehicle not found", ex.getMessage());
	}

	@Test
	void getAllMapsEveryVehicle() {
		Vehicle vehicle = new Vehicle();
		vehicle.setVehicleId(UUID.randomUUID());
		when(vehicleRepository.findAll()).thenReturn(List.of(vehicle));

		assertEquals(1, service.getAll().size());
	}

	@Test
	void deleteRemovesTheLoadedVehicle() {
		UUID id = UUID.randomUUID();
		Vehicle existing = new Vehicle();
		existing.setVehicleId(id);
		when(vehicleRepository.findById(id)).thenReturn(Optional.of(existing));

		service.delete(id);

		verify(vehicleRepository).delete(existing);
	}

	// ---- the registration number is validated by the server, whatever the screen sent

	@Test
	void createRejectsAnInvalidRegistrationNumberBeforeAnythingElseHappens() {
		for (String invalid : new String[] { "KA0512", "12345678", "KA05MH12345", "KA05MHXY1234", "KA@5MH1234", "K05MH1234", "TN01AB123", "TAMILNADU1", "DL1CAB1234", "DL3CD1234", "22BH1234ABC", "22BH123A", "TN01AB1234 X",
				"TN-01-AB-00442222222", "TN01AB00442222222", "DL3C12345678" }) {
			com.cbg.lbos.exception.BadRequestException ex = assertThrows(com.cbg.lbos.exception.BadRequestException.class,
					() -> service.create(requestDto(invalid)), invalid);
			assertEquals("Enter a valid vehicle registration number.", ex.getMessage(), invalid);
		}
		verify(vehicleRepository, never()).save(any(Vehicle.class));
		verify(vehicleRepository, never()).existsByRegistrationNumber(any());
	}

	@Test
	void createRejectsABlankRegistrationNumber() {
		for (String blank : new String[] { null, "", "  ", "-" }) {
			com.cbg.lbos.exception.BadRequestException ex = assertThrows(com.cbg.lbos.exception.BadRequestException.class,
					() -> service.create(requestDto(blank)));
			assertEquals("Vehicle registration number is required.", ex.getMessage());
		}
	}

	@Test
	void theSupportedIndianFormatsPassTheRule() {
		for (String valid : new String[] { "TN01AB1234", "KA05JK4471", "TS08UB2210", "MH12AB1234", "MH12A1234", "DL3C1234", "22BH1234A", "22BH1234AB", "tn 01 ab 1234", "TN-01-AB-1234", "DL-3C-1234", "22-BH-1234-A" }) {
			org.junit.jupiter.api.Assertions.assertDoesNotThrow(() -> com.cbg.lbos.validation.FleetIdentifierRules.requireValidVehicleNumber(valid), valid);
		}
		assertEquals("TN01AB1234", com.cbg.lbos.validation.FleetIdentifierRules.requireValidVehicleNumber(" tn-01 ab 1234 "));
	}
}
