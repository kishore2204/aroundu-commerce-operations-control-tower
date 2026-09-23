package com.cbg.lbos.service;

import com.cbg.lbos.client.S2PartnerClient;
import com.cbg.lbos.dto.DriverDto;
import com.cbg.lbos.dto.FleetOwnerValidationDto;
import com.cbg.lbos.entity.AssignmentStatus;
import com.cbg.lbos.entity.Driver;
import com.cbg.lbos.entity.DriverStatus;
import com.cbg.lbos.repository.DriverRepository;
import com.cbg.lbos.repository.VehicleAssignmentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DriverServiceImplTest {

	@Mock
	private DriverRepository driverRepository;
	@Mock
	private VehicleAssignmentRepository assignmentRepository;
	@Mock
	private S2PartnerClient s2PartnerClient;

	@InjectMocks
	private DriverServiceImpl service;

	private UUID userAccountId;
	private UUID fleetOwnerId;

	@BeforeEach
	void setUp() {
		userAccountId = UUID.randomUUID();
		fleetOwnerId = UUID.randomUUID();
	}

	private DriverDto requestDto(String licenseNumber) {
		DriverDto dto = new DriverDto();
		dto.setUserAccountId(userAccountId);
		dto.setFleetOwnerId(fleetOwnerId);
		dto.setCityId(UUID.randomUUID());
		dto.setLicenseNumber(licenseNumber);
		dto.setLicenseExpiryDate(LocalDate.now().plusYears(2));
		return dto;
	}

	private FleetOwnerValidationDto fleetOwnerValidation(String profileStatus, String ownerStatus) {
		FleetOwnerValidationDto validation = new FleetOwnerValidationDto();
		validation.setFleetOwnerId(fleetOwnerId);
		validation.setProfileStatus(profileStatus);
		validation.setOwnerStatus(ownerStatus);
		return validation;
	}

	private void stubVerifiedActiveFleetOwner() {
		when(s2PartnerClient.validateFleetOwner(fleetOwnerId))
				.thenReturn(fleetOwnerValidation("VERIFIED", "ACTIVE"));
	}

	private void stubSaveEcho() {
		when(driverRepository.save(any(Driver.class))).thenAnswer(invocation -> invocation.getArgument(0));
	}

	@Test
	void createSavesDriverAsInactiveWhenTheFleetOwnerIsVerifiedAndActiveAndTheLicenseIsValid() {
		LocalDate expiry = LocalDate.now().plusYears(2);
		stubVerifiedActiveFleetOwner();
		when(driverRepository.existsByLicenseNumber("KA0120190012345")).thenReturn(false);
		when(driverRepository.existsByUserAccountId(userAccountId)).thenReturn(false);
		stubSaveEcho();

		DriverDto request = requestDto("KA0120190012345");
		request.setLicenseExpiryDate(expiry);
		DriverDto result = service.create(request);

		ArgumentCaptor<Driver> captor = ArgumentCaptor.forClass(Driver.class);
		verify(driverRepository).save(captor.capture());
		Driver saved = captor.getValue();
		assertEquals("KA0120190012345", saved.getLicenseNumber());
		// A newly onboarded driver always starts INACTIVE, regardless of the fleet owner's own
		// verification status - it isn't fit for assignment until the driver itself is verified
		// (see DriverServiceImpl.create() and submitForVerification()/changeStatus()).
		assertEquals(DriverStatus.INACTIVE, saved.getDriverStatus());
		assertEquals(expiry, saved.getLicenseExpiryDate());
		assertEquals(userAccountId, saved.getUserAccountId());
		assertEquals(fleetOwnerId, saved.getFleetOwnerId());
		assertEquals(DriverStatus.INACTIVE, result.getDriverStatus());
		assertEquals("KA0120190012345", result.getLicenseNumber());
	}

	@Test
	void createNormalizesLicenseNumberByStrippingSpacesAndUpperCasing() {
		stubVerifiedActiveFleetOwner();
		when(driverRepository.existsByLicenseNumber("KA0120190012345")).thenReturn(false);
		when(driverRepository.existsByUserAccountId(userAccountId)).thenReturn(false);
		stubSaveEcho();

		DriverDto result = service.create(requestDto("  ka 01 2019 0012345 "));

		assertEquals("KA0120190012345", result.getLicenseNumber());
		verify(driverRepository).existsByLicenseNumber("KA0120190012345");
	}

	@Test
	void createRejectsWhenTheFleetOwnerIsNotVerified() {
		when(s2PartnerClient.validateFleetOwner(fleetOwnerId))
				.thenReturn(fleetOwnerValidation("PENDING_VERIFICATION", "ACTIVE"));

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.create(requestDto("KA0120190012345")));

		assertEquals("Fleet owner is not active and verified in S2", ex.getMessage());
		verify(driverRepository, never()).save(any(Driver.class));
	}

	@Test
	void createRejectsWhenTheFleetOwnerIsNotActive() {
		when(s2PartnerClient.validateFleetOwner(fleetOwnerId))
				.thenReturn(fleetOwnerValidation("VERIFIED", "SUSPENDED"));

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.create(requestDto("KA0120190012345")));

		assertEquals("Fleet owner is not active and verified in S2", ex.getMessage());
		verify(driverRepository, never()).save(any(Driver.class));
	}

	@Test
	void createRejectsWhenLicenseAlreadyExpired() {
		stubVerifiedActiveFleetOwner();
		DriverDto request = requestDto("KA0120190012345");
		request.setLicenseExpiryDate(LocalDate.now().minusDays(1));

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.create(request));

		assertEquals("Driver license expired", ex.getMessage());
	}

	@Test
	void createRejectsWhenLicenseExpiryIsMissing() {
		stubVerifiedActiveFleetOwner();
		DriverDto request = requestDto("KA0120190012345");
		request.setLicenseExpiryDate(null);

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.create(request));

		assertEquals("Driver license expired", ex.getMessage());
	}

	@Test
	void createRejectsWhenLicenseExpiresToday() {
		stubVerifiedActiveFleetOwner();
		DriverDto request = requestDto("KA0120190012345");
		request.setLicenseExpiryDate(LocalDate.now());

		assertThrows(RuntimeException.class, () -> service.create(request));
	}

	@Test
	void createRejectsDuplicateLicenseNumber() {
		stubVerifiedActiveFleetOwner();
		when(driverRepository.existsByLicenseNumber("KA0120190012345")).thenReturn(true);

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.create(requestDto("KA0120190012345")));

		assertEquals("Driver exists", ex.getMessage());
		verify(driverRepository, never()).save(any(Driver.class));
	}

	@Test
	void createRejectsDuplicateUserAccountId() {
		stubVerifiedActiveFleetOwner();
		when(driverRepository.existsByLicenseNumber("KA0120190012345")).thenReturn(false);
		when(driverRepository.existsByUserAccountId(userAccountId)).thenReturn(true);

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.create(requestDto("KA0120190012345")));

		assertEquals("Driver exists", ex.getMessage());
		verify(driverRepository, never()).save(any(Driver.class));
	}

	@Test
	void availableReturnsOnlyActiveDriversWithoutAnActiveAssignment() {
		Driver free = new Driver();
		free.setDriverId(UUID.randomUUID());
		free.setLicenseNumber("FREE1");
		free.setDriverStatus(DriverStatus.ACTIVE);

		Driver busy = new Driver();
		busy.setDriverId(UUID.randomUUID());
		busy.setLicenseNumber("BUSY1");
		busy.setDriverStatus(DriverStatus.ACTIVE);

		when(driverRepository.findByDriverStatus(DriverStatus.ACTIVE)).thenReturn(Arrays.asList(free, busy));
		when(assignmentRepository.existsByDriverIdAndAssignmentStatus(free.getDriverId(), AssignmentStatus.ACTIVE))
				.thenReturn(false);
		when(assignmentRepository.existsByDriverIdAndAssignmentStatus(busy.getDriverId(), AssignmentStatus.ACTIVE))
				.thenReturn(true);

		List<DriverDto> result = service.available();

		assertEquals(1, result.size());
		assertEquals("FREE1", result.get(0).getLicenseNumber());
	}

	@Test
	void availableReturnsEmptyListWhenNoActiveDriversExist() {
		when(driverRepository.findByDriverStatus(DriverStatus.ACTIVE)).thenReturn(List.of());

		assertTrue(service.available().isEmpty());
	}

	@Test
	void changeStatusPersistsTheNewStatus() {
		UUID id = UUID.randomUUID();
		Driver existing = new Driver();
		existing.setDriverId(id);
		existing.setDriverStatus(DriverStatus.ACTIVE);
		when(driverRepository.findById(id)).thenReturn(Optional.of(existing));
		stubSaveEcho();

		DriverDto result = service.changeStatus(id, DriverStatus.SUSPENDED);

		assertEquals(DriverStatus.SUSPENDED, result.getDriverStatus());
		assertEquals(DriverStatus.SUSPENDED, existing.getDriverStatus());
		verify(driverRepository).save(existing);
	}

	@Test
	void changeStatusThrowsWhenDriverIsMissing() {
		UUID id = UUID.randomUUID();
		when(driverRepository.findById(id)).thenReturn(Optional.empty());

		RuntimeException ex = assertThrows(RuntimeException.class,
				() -> service.changeStatus(id, DriverStatus.INACTIVE));

		assertEquals("Driver not found", ex.getMessage());
	}

	@Test
	void getReturnsMappedDriver() {
		UUID id = UUID.randomUUID();
		Driver existing = new Driver();
		existing.setDriverId(id);
		existing.setLicenseNumber("DL09XY7777");
		existing.setDriverStatus(DriverStatus.ACTIVE);
		when(driverRepository.findById(id)).thenReturn(Optional.of(existing));

		DriverDto result = service.get(id);

		assertEquals(id, result.getDriverId());
		assertEquals("DL09XY7777", result.getLicenseNumber());
	}

	@Test
	void getThrowsWhenDriverIsMissing() {
		UUID id = UUID.randomUUID();
		when(driverRepository.findById(id)).thenReturn(Optional.empty());

		RuntimeException ex = assertThrows(RuntimeException.class, () -> service.get(id));

		assertEquals("Driver not found", ex.getMessage());
	}

	@Test
	void getAllMapsEveryDriver() {
		Driver driverOne = new Driver();
		driverOne.setDriverId(UUID.randomUUID());
		Driver driverTwo = new Driver();
		driverTwo.setDriverId(UUID.randomUUID());
		when(driverRepository.findAll()).thenReturn(Arrays.asList(driverOne, driverTwo));

		assertEquals(2, service.getAll().size());
	}

	@Test
	void deleteRemovesTheLoadedDriver() {
		UUID id = UUID.randomUUID();
		Driver existing = new Driver();
		existing.setDriverId(id);
		when(driverRepository.findById(id)).thenReturn(Optional.of(existing));

		service.delete(id);

		verify(driverRepository, times(1)).delete(existing);
	}

	@Test
	void deleteThrowsWhenDriverIsMissing() {
		UUID id = UUID.randomUUID();
		when(driverRepository.findById(id)).thenReturn(Optional.empty());

		assertThrows(RuntimeException.class, () -> service.delete(id));
		verify(driverRepository, never()).delete(any(Driver.class));
	}

	// ---- the licence number is validated by the server, whatever the screen sent

	@Test
	void createRejectsAnInvalidLicenceBeforeAnythingIsCreated() {
		for (String invalid : new String[] { "KA01AB1234", "ABCDE", "KA05201900412", "KA0520190041", "KA05201900412345678", "KA05@2019004125", "1234567890", "5A05201900412567" }) {
			com.cbg.lbos.exception.BadRequestException ex = assertThrows(com.cbg.lbos.exception.BadRequestException.class,
					() -> service.create(requestDto(invalid)), invalid);
			assertEquals("Enter a valid driving licence number.", ex.getMessage(), invalid);
		}
		// nothing was looked up, no login account was created and no driver was saved
		verify(driverRepository, never()).save(any(Driver.class));
		verify(driverRepository, never()).existsByLicenseNumber(any());
	}

	@Test
	void createRejectsABlankLicence() {
		for (String blank : new String[] { null, "", "   ", " - " }) {
			com.cbg.lbos.exception.BadRequestException ex = assertThrows(com.cbg.lbos.exception.BadRequestException.class,
					() -> service.create(requestDto(blank)));
			assertEquals("Driving licence number is required.", ex.getMessage());
		}
	}

	@Test
	void aLicenceTypedWithSpacesHyphensAndLowerCaseIsStoredNormalised() {
		LocalDate expiry = LocalDate.now().plusYears(2);
		stubVerifiedActiveFleetOwner();
		when(driverRepository.existsByLicenseNumber("KA0520190041256")).thenReturn(false);
		when(driverRepository.existsByUserAccountId(userAccountId)).thenReturn(false);
		stubSaveEcho();

		DriverDto request = requestDto(" ka-05 2019 0041256 ");
		request.setLicenseExpiryDate(expiry);

		assertEquals("KA0520190041256", service.create(request).getLicenseNumber());
	}

	@Test
	void bothSupportedLicenceLengthsPassTheRule() {
		for (String valid : new String[] { "TN1420110012345", "KA05201200123456", "KA0520190041256", "ka-05 2012 00123456", " TN 14 2011 0012345 " }) {
			org.junit.jupiter.api.Assertions.assertDoesNotThrow(() -> com.cbg.lbos.validation.FleetIdentifierRules.requireValidLicence(valid), valid);
		}
		assertEquals("KA05201200123456", com.cbg.lbos.validation.FleetIdentifierRules.requireValidLicence("ka-05 2012 00123456"));
	}

	@Test
	void savingTheProfileWithTheLicenceAlreadyStoredIsNotRevalidated_evenIfItPredatesTheRule() {
		Driver existing = new Driver();
		existing.setLicenseNumber("OLDFORMAT1"); // stored before the format rule existed
		UUID id = UUID.randomUUID();
		when(driverRepository.findById(id)).thenReturn(java.util.Optional.of(existing));
		when(driverRepository.save(any(Driver.class))).thenAnswer(invocation -> invocation.getArgument(0));

		DriverDto result = service.updateLicense(id, "old-format1", LocalDate.now().plusYears(1));

		assertEquals("OLDFORMAT1", result.getLicenseNumber());
		verify(driverRepository, never()).existsByLicenseNumber(any());
	}

	@Test
	void updatingALicenceToAnInvalidValueIsRejectedAndTheDriverIsUnchanged() {
		Driver existing = new Driver();
		existing.setLicenseNumber("KA0520190041256");
		UUID id = UUID.randomUUID();
		when(driverRepository.findById(id)).thenReturn(java.util.Optional.of(existing));

		assertThrows(com.cbg.lbos.exception.BadRequestException.class, () -> service.updateLicense(id, "NOT-A-LICENCE", null));

		assertEquals("KA0520190041256", existing.getLicenseNumber());
		verify(driverRepository, never()).save(any(Driver.class));
	}
}
