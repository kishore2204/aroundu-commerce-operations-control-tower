package com.cbg.lbos.service;

import com.cbg.lbos.client.DriverClient;
import com.cbg.lbos.client.FleetOwnerClient;
import com.cbg.lbos.client.SettlementClient;
import com.cbg.lbos.client.UserAccountClient;
import com.cbg.lbos.client.VehicleClient;
import com.cbg.lbos.client.dto.DriverSummary;
import com.cbg.lbos.client.dto.UserAccountSummary;
import com.cbg.lbos.client.dto.VehicleSummary;
import com.cbg.lbos.dto.TripDto;
import com.cbg.lbos.entity.Order;
import com.cbg.lbos.entity.Trip;
import com.cbg.lbos.exception.DuplicateResourceException;
import com.cbg.lbos.exception.ResourceNotFoundException;
import com.cbg.lbos.repository.LogisticsBookingDetailRepository;
import com.cbg.lbos.repository.OrderRepository;
import com.cbg.lbos.repository.TripRepository;
import com.cbg.lbos.repository.TripStatusHistoryRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import feign.FeignException;
import feign.Request;
import feign.RequestTemplate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TripServiceTest {

    private static final Long ORDER_ID = 77L;
    private static final UUID TRIP_ID = UUID.randomUUID();
    private static final UUID VEHICLE_ID = UUID.randomUUID();
    private static final UUID DRIVER_ID = UUID.randomUUID();
    private static final UUID FLEET_OWNER_ID = UUID.randomUUID();
    private static final UUID CREATED_BY_ID = UUID.randomUUID();
    private static final UUID ASSIGNED_BY_ID = UUID.randomUUID();

    /*
     * Proof of pickup/delivery is a mandatory *image*: TripService.validateImageProof() accepts
     * only an http(s) URL or a data:image/ URI, so a bare file name is no longer a usable proof
     * anywhere in these fixtures.
     */
    private static final String PICKUP_IMAGE = "https://cdn.aroundu.test/proofs/pickup-photo.jpg";
    private static final String DELIVERY_IMAGE = "https://cdn.aroundu.test/proofs/delivered.jpg";

    @Mock
    private TripRepository tripRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private VehicleClient vehicleClient;

    @Mock
    private DriverClient driverClient;

    @Mock
    private UserAccountClient userAccountClient;

    /*
     * The four dependencies below are constructor arguments of TripService that this test did
     * not declare, so @InjectMocks was passing null for each of them:
     *   - fleetOwnerClient: toDto() enriches every trip with its fleet owner,
     *   - tripStatusHistoryRepository: create()/update() record an audit row per status change,
     *   - settlementClient: completing a trip triggers the (best-effort) settlement,
     *   - logisticsBookingDetailRepository/objectMapper: toDto() resolves the booking's
     *     pickup/drop addresses.
     */
    @Mock
    private FleetOwnerClient fleetOwnerClient;

    @Mock
    private SettlementClient settlementClient;

    @Mock
    private TripStatusHistoryRepository tripStatusHistoryRepository;

    @Mock
    private LogisticsBookingDetailRepository logisticsBookingDetailRepository;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private OrderWeightService orderWeightService;

    @InjectMocks
    private TripService tripService;

    private Order fleetOrder() {
        Order order = new Order();
        order.setId(ORDER_ID);
        order.setOrderType("FLEET_SERVICE");
        order.setOrderStatus("BOOKING_CONFIRMED");
        return order;
    }

    private VehicleSummary vehicle(String status, UUID fleetOwnerId) {
        return new VehicleSummary(
                VEHICLE_ID, fleetOwnerId, UUID.randomUUID(),
                "KA01AB1234", "TRUCK", "Tata", "Ace", 2022,
                new BigDecimal("1000.00"), status);
    }

    private DriverSummary driver(String status, UUID fleetOwnerId, LocalDate expiry) {
        return new DriverSummary(
                DRIVER_ID, fleetOwnerId, UUID.randomUUID(), UUID.randomUUID(),
                UUID.randomUUID(), "DL-99-2020", expiry, status, new BigDecimal("80.00"));
    }

    private UserAccountSummary account(UUID id) {
        return new UserAccountSummary(id, "FLEET_MANAGER", "ACTIVE");
    }

    private TripDto validCreateDto() {
        TripDto dto = new TripDto();
        dto.setOrderId(ORDER_ID);
        dto.setVehicleId(VEHICLE_ID);
        dto.setDriverId(DRIVER_ID);
        dto.setFleetOwnerId(FLEET_OWNER_ID);
        dto.setCreatedByAccountId(CREATED_BY_ID);
        dto.setAssignedByAccountId(ASSIGNED_BY_ID);
        dto.setTripNumber("TRIP-001");
        dto.setPlannedStartAt(OffsetDateTime.now().plusHours(4));
        dto.setDistanceKm(new BigDecimal("120.50"));
        return dto;
    }

    private Trip existingTrip(String status) {
        Trip trip = new Trip();
        trip.setId(TRIP_ID);
        trip.setOrder(fleetOrder());
        trip.setVehicleId(VEHICLE_ID);
        trip.setDriverId(DRIVER_ID);
        trip.setFleetOwnerId(FLEET_OWNER_ID);
        trip.setCreatedByAccountId(CREATED_BY_ID);
        trip.setTripNumber("TRIP-001");
        trip.setTripStatus(status);
        trip.setPlannedStartAt(OffsetDateTime.now().plusHours(2));
        return trip;
    }

    /**
     * A trip that has genuinely started: planned start is in the past and the
     * actual start follows it, so the chronology validation is satisfied.
     */
    private Trip startedTrip(String status) {
        Trip trip = existingTrip(status);
        trip.setPlannedStartAt(OffsetDateTime.now().minusHours(3));
        trip.setActualStartAt(OffsetDateTime.now().minusHours(1));
        return trip;
    }

    /**
     * An update request against an already-started trip must not push the
     * planned start into the future - that would contradict the actual start.
     */
    private TripDto startedTripUpdateDto(String status) {
        TripDto dto = validCreateDto();
        dto.setTripStatus(status);
        dto.setPlannedStartAt(null);
        return dto;
    }

    /** Stubs the full "everything is valid" create path. */
    private void stubHappyCreate() {
        lenient().when(tripRepository.existsByTripNumber(anyString())).thenReturn(false);
        lenient().when(tripRepository.existsByOrder_Id(ORDER_ID)).thenReturn(false);
        lenient().when(orderRepository.findById(ORDER_ID))
                .thenReturn(Optional.of(fleetOrder()));
        lenient().when(vehicleClient.getVehicle(VEHICLE_ID))
                .thenReturn(vehicle("ACTIVE", FLEET_OWNER_ID));
        lenient().when(driverClient.getDriver(DRIVER_ID))
                .thenReturn(driver("ACTIVE", FLEET_OWNER_ID, LocalDate.now().plusYears(2)));
        lenient().when(userAccountClient.getUserAccount(any(UUID.class)))
                .thenAnswer(invocation -> account(invocation.getArgument(0)));
        lenient().when(tripRepository.existsByVehicleIdAndTripStatusIn(
                eq(VEHICLE_ID), anyCollection())).thenReturn(false);
        lenient().when(tripRepository.existsByDriverIdAndTripStatusIn(
                eq(DRIVER_ID), anyCollection())).thenReturn(false);
        lenient().when(tripRepository.save(any(Trip.class)))
                .thenAnswer(invocation -> {
                    Trip saved = invocation.getArgument(0);
                    saved.setId(TRIP_ID);
                    return saved;
                });
    }

    private void stubAssignmentUpdate() {
        lenient().when(vehicleClient.getVehicle(VEHICLE_ID))
                .thenReturn(vehicle("ACTIVE", FLEET_OWNER_ID));
        lenient().when(driverClient.getDriver(DRIVER_ID))
                .thenReturn(driver("ACTIVE", FLEET_OWNER_ID, LocalDate.now().plusYears(2)));
        lenient().when(userAccountClient.getUserAccount(any(UUID.class)))
                .thenAnswer(invocation -> account(invocation.getArgument(0)));
        lenient().when(tripRepository.existsByVehicleIdAndTripStatusInAndIdNot(
                eq(VEHICLE_ID), anyCollection(), eq(TRIP_ID))).thenReturn(false);
        lenient().when(tripRepository.existsByDriverIdAndTripStatusInAndIdNot(
                eq(DRIVER_ID), anyCollection(), eq(TRIP_ID))).thenReturn(false);
        lenient().when(tripRepository.save(any(Trip.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    private FeignException feignError(int status, String url) {
        Request request = Request.create(
                Request.HttpMethod.GET, url, new HashMap<>(), null,
                StandardCharsets.UTF_8, new RequestTemplate());
        return FeignException.errorStatus("client#get(UUID)",
                feign.Response.builder()
                        .status(status)
                        .reason("error")
                        .request(request)
                        .headers(new HashMap<>())
                        .build());
    }

    // ---------- CREATE ----------

    @Test
    void createStoresScalarIdsAndAlwaysStartsThePlannedStatus() {
        stubHappyCreate();

        TripDto result = tripService.create(validCreateDto());

        assertEquals(TRIP_ID, result.getId());
        assertEquals("PLANNED", result.getTripStatus());
        assertEquals(VEHICLE_ID, result.getVehicleId());
        assertEquals(DRIVER_ID, result.getDriverId());
        assertEquals(FLEET_OWNER_ID, result.getFleetOwnerId());
        assertEquals(CREATED_BY_ID, result.getCreatedByAccountId());
        assertEquals(ASSIGNED_BY_ID, result.getAssignedByAccountId());
        assertEquals(ORDER_ID, result.getOrderId());
    }

    @Test
    void createBlocksAssignmentWhenTheOrderIsHeavierThanTheVehicleCapacity() {
        stubHappyCreate(); // vehicle capacity is 1000 kg
        when(orderWeightService.totalWeightKg(ORDER_ID)).thenReturn(new BigDecimal("1200"));

        IllegalArgumentException failure = assertThrows(IllegalArgumentException.class,
                () -> tripService.create(validCreateDto()));

        assertEquals("Order weight (1200 kg) exceeds the selected vehicle capacity (1000 kg). Please select another vehicle.",
                failure.getMessage());
        verify(tripRepository, never()).save(any(Trip.class));
    }

    @Test
    void createAllowsAnOrderUpToTheVehicleCapacity() {
        stubHappyCreate();
        when(orderWeightService.totalWeightKg(ORDER_ID)).thenReturn(new BigDecimal("1000.000"));

        assertEquals("PLANNED", tripService.create(validCreateDto()).getTripStatus());
    }

    @Test
    void createSynchronisesTheOrderStatusToVehicleAssigned() {
        Order order = fleetOrder();
        when(tripRepository.existsByTripNumber(anyString())).thenReturn(false);
        when(tripRepository.existsByOrder_Id(ORDER_ID)).thenReturn(false);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
        when(vehicleClient.getVehicle(VEHICLE_ID))
                .thenReturn(vehicle("ACTIVE", FLEET_OWNER_ID));
        when(driverClient.getDriver(DRIVER_ID))
                .thenReturn(driver("ACTIVE", FLEET_OWNER_ID, LocalDate.now().plusYears(2)));
        when(userAccountClient.getUserAccount(any(UUID.class)))
                .thenAnswer(invocation -> account(invocation.getArgument(0)));
        when(tripRepository.existsByVehicleIdAndTripStatusIn(
                eq(VEHICLE_ID), anyCollection())).thenReturn(false);
        when(tripRepository.existsByDriverIdAndTripStatusIn(
                eq(DRIVER_ID), anyCollection())).thenReturn(false);
        when(tripRepository.save(any(Trip.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        tripService.create(validCreateDto());

        assertEquals("VEHICLE_ASSIGNED", order.getOrderStatus());
    }

    @Test
    void createRejectsADuplicateTripNumber() {
        when(tripRepository.existsByTripNumber("TRIP-001")).thenReturn(true);

        assertEquals("Trip number already exists: TRIP-001",
                assertThrows(DuplicateResourceException.class,
                        () -> tripService.create(validCreateDto())).getMessage());
    }

    @Test
    void createRejectsASecondTripForTheSameOrder() {
        when(tripRepository.existsByTripNumber(anyString())).thenReturn(false);
        when(tripRepository.existsByOrder_Id(ORDER_ID)).thenReturn(true);

        assertEquals("A trip already exists for order ID: 77",
                assertThrows(DuplicateResourceException.class,
                        () -> tripService.create(validCreateDto())).getMessage());
    }

    @Test
    void createRequiresAVehicleId() {
        TripDto dto = validCreateDto();
        dto.setVehicleId(null);

        assertEquals("Vehicle ID is required",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.create(dto)).getMessage());
    }

    @Test
    void createRequiresAFleetOwnerId() {
        TripDto dto = validCreateDto();
        dto.setFleetOwnerId(null);

        assertEquals("Fleet owner ID is required",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.create(dto)).getMessage());
    }

    @Test
    void createRejectsAPlannedStartTimeInThePast() {
        TripDto dto = validCreateDto();
        dto.setPlannedStartAt(OffsetDateTime.now().minusHours(1));

        assertEquals("Planned start time cannot be in the past",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.create(dto)).getMessage());
    }

    @Test
    void createRejectsANegativeDistance() {
        TripDto dto = validCreateDto();
        dto.setDistanceKm(new BigDecimal("-5"));

        assertEquals("Trip distance cannot be negative",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.create(dto)).getMessage());
    }

    /*
     * A trip now carries EITHER order type from delivery-assignment through to DELIVERED (see
     * TripService.validateOrderForTrip): a RETAIL order once it is FINDING_DELIVERY_PARTNER, a
     * FLEET_SERVICE order once it is BOOKING_CONFIRMED. Only a third, unknown order type is
     * rejected outright - this test used to assert the old "FLEET_SERVICE only" rule.
     */
    @Test
    void createIsRejectedForAnOrderTypeThatIsNeitherRetailNorFleetService() {
        Order subscription = fleetOrder();
        subscription.setOrderType("SUBSCRIPTION");
        stubHappyCreate();
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(subscription));

        assertEquals("Trip can only be created for a RETAIL or FLEET_SERVICE order",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.create(validCreateDto())).getMessage());
    }

    @Test
    void createIsRejectedForARetailOrderThatIsNotYetFindingADeliveryPartner() {
        Order retail = fleetOrder();
        retail.setOrderType("RETAIL");
        retail.setOrderStatus("WAITING_FOR_RETAILER");
        stubHappyCreate();
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(retail));

        assertEquals("A RETAIL order must be FINDING_DELIVERY_PARTNER before a trip can be "
                        + "created, was: WAITING_FOR_RETAILER",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.create(validCreateDto())).getMessage());
    }

    @Test
    void createIsAllowedForARetailOrderThatIsFindingADeliveryPartner() {
        Order retail = fleetOrder();
        retail.setOrderType("RETAIL");
        retail.setOrderStatus("FINDING_DELIVERY_PARTNER");
        stubHappyCreate();
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(retail));

        assertEquals("PLANNED", tripService.create(validCreateDto()).getTripStatus());
        assertEquals("VEHICLE_ASSIGNED", retail.getOrderStatus());
    }

    /*
     * A cancelled order is still rejected - the rejection now comes from the per-order-type
     * status precondition rather than a dedicated "cancelled" branch, hence the message.
     */
    @Test
    void createIsRejectedForACancelledOrder() {
        Order cancelled = fleetOrder();
        cancelled.setOrderStatus("CANCELLED");
        stubHappyCreate();
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(cancelled));

        assertEquals("A FLEET_SERVICE order must be BOOKING_CONFIRMED before a trip can be "
                        + "created, was: CANCELLED",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.create(validCreateDto())).getMessage());
    }

    @Test
    void createIsRejectedForAnAlreadyDeliveredOrder() {
        Order delivered = fleetOrder();
        delivered.setOrderStatus("DELIVERED");
        stubHappyCreate();
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(delivered));

        assertThrows(IllegalArgumentException.class,
                () -> tripService.create(validCreateDto()));
    }

    @Test
    void createRequiresAnActiveVehicle() {
        stubHappyCreate();
        when(vehicleClient.getVehicle(VEHICLE_ID))
                .thenReturn(vehicle("MAINTENANCE", FLEET_OWNER_ID));

        assertEquals("Only an ACTIVE vehicle can be assigned to a trip",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.create(validCreateDto())).getMessage());
    }

    @Test
    void createRequiresAnActiveDriver() {
        stubHappyCreate();
        when(driverClient.getDriver(DRIVER_ID))
                .thenReturn(driver("SUSPENDED", FLEET_OWNER_ID,
                        LocalDate.now().plusYears(2)));

        assertEquals("Only an ACTIVE driver can be assigned to a trip",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.create(validCreateDto())).getMessage());
    }

    @Test
    void createRejectsADriverWithAnExpiredLicence() {
        stubHappyCreate();
        when(driverClient.getDriver(DRIVER_ID))
                .thenReturn(driver("ACTIVE", FLEET_OWNER_ID,
                        LocalDate.now().minusDays(1)));

        assertEquals("Driver licence has expired",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.create(validCreateDto())).getMessage());
    }

    @Test
    void createRejectsADriverWithNoLicenceExpiryDate() {
        stubHappyCreate();
        when(driverClient.getDriver(DRIVER_ID))
                .thenReturn(driver("ACTIVE", FLEET_OWNER_ID, null));

        assertEquals("Driver licence expiry date is required",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.create(validCreateDto())).getMessage());
    }

    @Test
    void createRejectsAVehicleOwnedByADifferentFleetOwner() {
        stubHappyCreate();
        when(vehicleClient.getVehicle(VEHICLE_ID))
                .thenReturn(vehicle("ACTIVE", UUID.randomUUID()));

        assertEquals("Selected vehicle does not belong to the selected fleet owner",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.create(validCreateDto())).getMessage());
    }

    @Test
    void createRejectsADriverOwnedByADifferentFleetOwner() {
        stubHappyCreate();
        when(driverClient.getDriver(DRIVER_ID))
                .thenReturn(driver("ACTIVE", UUID.randomUUID(),
                        LocalDate.now().plusYears(2)));

        assertEquals("Selected driver does not belong to the selected fleet owner",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.create(validCreateDto())).getMessage());
    }

    @Test
    void createRejectsAVehicleAlreadyOnAnotherActiveTrip() {
        stubHappyCreate();
        when(tripRepository.existsByVehicleIdAndTripStatusIn(
                eq(VEHICLE_ID), anyCollection())).thenReturn(true);

        assertEquals("Selected vehicle is already assigned to another active trip",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.create(validCreateDto())).getMessage());
    }

    @Test
    void createRejectsADriverAlreadyOnAnotherActiveTrip() {
        stubHappyCreate();
        when(tripRepository.existsByDriverIdAndTripStatusIn(
                eq(DRIVER_ID), anyCollection())).thenReturn(true);

        assertEquals("Selected driver is already assigned to another active trip",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.create(validCreateDto())).getMessage());
    }

    @Test
    void createThrowsWhenTheLocalOrderIsMissing() {
        when(tripRepository.existsByTripNumber(anyString())).thenReturn(false);
        when(tripRepository.existsByOrder_Id(ORDER_ID)).thenReturn(false);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.empty());

        assertEquals("Order not found with ID: 77",
                assertThrows(ResourceNotFoundException.class,
                        () -> tripService.create(validCreateDto())).getMessage());
    }

    @Test
    void createTranslatesAFleetServiceFailureIntoResourceNotFound() {
        stubHappyCreate();
        when(vehicleClient.getVehicle(VEHICLE_ID))
                .thenThrow(feignError(500, "/api/vehicles/" + VEHICLE_ID));

        assertEquals("Vehicle not found with ID: " + VEHICLE_ID,
                assertThrows(ResourceNotFoundException.class,
                        () -> tripService.create(validCreateDto())).getMessage());
    }

    @Test
    void createTranslatesAMissingDriverIntoResourceNotFound() {
        stubHappyCreate();
        when(driverClient.getDriver(DRIVER_ID))
                .thenThrow(feignError(404, "/api/drivers/" + DRIVER_ID));

        assertEquals("Driver not found with ID: " + DRIVER_ID,
                assertThrows(ResourceNotFoundException.class,
                        () -> tripService.create(validCreateDto())).getMessage());
    }

    @Test
    void createTranslatesAMissingCreatorAccountIntoResourceNotFound() {
        stubHappyCreate();
        when(userAccountClient.getUserAccount(CREATED_BY_ID))
                .thenThrow(feignError(404, "/internal/v1/user-accounts/" + CREATED_BY_ID));

        assertEquals("Creator account not found with ID: " + CREATED_BY_ID,
                assertThrows(ResourceNotFoundException.class,
                        () -> tripService.create(validCreateDto())).getMessage());
        verify(tripRepository, never()).save(any(Trip.class));
    }

    @Test
    void createSkipsTheAccountLookupWhenNoAssignerIsSupplied() {
        stubHappyCreate();

        TripDto dto = validCreateDto();
        dto.setAssignedByAccountId(null);

        assertEquals(null, tripService.create(dto).getAssignedByAccountId());
        verify(userAccountClient).getUserAccount(CREATED_BY_ID);
        verify(userAccountClient, never()).getUserAccount(ASSIGNED_BY_ID);
    }

    // ---------- STATUS STATE MACHINE ----------

    @Test
    void updateAllowsPlannedToAssigned() {
        when(tripRepository.findById(TRIP_ID))
                .thenReturn(Optional.of(existingTrip("PLANNED")));
        stubAssignmentUpdate();

        TripDto dto = validCreateDto();
        dto.setTripStatus("ASSIGNED");

        TripDto result = tripService.update(TRIP_ID, dto);

        assertEquals("ASSIGNED", result.getTripStatus());
    }

    @Test
    void updateRejectsPlannedStraightToCompleted() {
        when(tripRepository.findById(TRIP_ID))
                .thenReturn(Optional.of(existingTrip("PLANNED")));

        TripDto dto = validCreateDto();
        dto.setTripStatus("COMPLETED");

        assertEquals("Invalid trip status transition from PLANNED to COMPLETED",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.update(TRIP_ID, dto)).getMessage());
    }

    @Test
    void updateRejectsAnyTransitionOutOfCompleted() {
        when(tripRepository.findById(TRIP_ID))
                .thenReturn(Optional.of(existingTrip("COMPLETED")));

        TripDto dto = validCreateDto();
        dto.setTripStatus("IN_PROGRESS");

        assertEquals("Invalid trip status transition from COMPLETED to IN_PROGRESS",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.update(TRIP_ID, dto)).getMessage());
    }

    @Test
    void updateRejectsAnUnknownStatus() {
        when(tripRepository.findById(TRIP_ID))
                .thenReturn(Optional.of(existingTrip("PLANNED")));

        TripDto dto = validCreateDto();
        dto.setTripStatus("TELEPORTING");

        assertEquals("Unsupported trip status: TELEPORTING",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.update(TRIP_ID, dto)).getMessage());
    }

    @Test
    void startingATripRequiresProofOfPickup() {
        when(tripRepository.findById(TRIP_ID))
                .thenReturn(Optional.of(existingTrip("ASSIGNED")));
        stubAssignmentUpdate();

        TripDto dto = validCreateDto();
        dto.setTripStatus("IN_PROGRESS");
        dto.setProofOfPickup(null);

        assertEquals("Pickup image is required to start the trip",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.update(TRIP_ID, dto)).getMessage());
    }

    @Test
    void startingATripRejectsAPickupProofThatIsNotAnImageReference() {
        when(tripRepository.findById(TRIP_ID))
                .thenReturn(Optional.of(existingTrip("ASSIGNED")));
        stubAssignmentUpdate();

        TripDto dto = validCreateDto();
        dto.setTripStatus("IN_PROGRESS");
        dto.setProofOfPickup("pickup-photo.jpg");

        assertEquals("A valid pickup image is required",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.update(TRIP_ID, dto)).getMessage());
        verify(tripRepository, never()).save(any(Trip.class));
    }

    @Test
    void startingATripStampsTheActualStartAndMovesTheOrderInTransit() {
        Trip trip = existingTrip("ASSIGNED");
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
        stubAssignmentUpdate();

        TripDto dto = validCreateDto();
        dto.setTripStatus("IN_PROGRESS");
        dto.setProofOfPickup(PICKUP_IMAGE);

        TripDto result = tripService.update(TRIP_ID, dto);

        assertEquals("IN_PROGRESS", result.getTripStatus());
        assertNotNull(result.getActualStartAt());
        assertEquals("IN_TRANSIT", trip.getOrder().getOrderStatus());
    }

    @Test
    void completingATripRequiresProofOfDelivery() {
        Trip trip = startedTrip("IN_PROGRESS");
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));

        TripDto dto = startedTripUpdateDto("COMPLETED");
        dto.setProofOfDelivery(null);

        assertEquals("Delivery image is required to complete the trip",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.update(TRIP_ID, dto)).getMessage());
    }

    @Test
    void completingATripRejectsADeliveryProofThatIsNotAnImageReference() {
        Trip trip = startedTrip("IN_PROGRESS");
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));

        TripDto dto = startedTripUpdateDto("COMPLETED");
        dto.setProofOfDelivery("delivered.jpg");

        assertEquals("A valid delivery image is required",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.update(TRIP_ID, dto)).getMessage());
        verify(tripRepository, never()).save(any(Trip.class));
    }

    @Test
    void completingATripRequiresAPositiveDistance() {
        Trip trip = startedTrip("IN_PROGRESS");
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));

        TripDto dto = startedTripUpdateDto("COMPLETED");
        dto.setDistanceKm(BigDecimal.ZERO);
        dto.setProofOfDelivery(DELIVERY_IMAGE);

        assertEquals("Completed trip must have a valid distance",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.update(TRIP_ID, dto)).getMessage());
    }

    /*
     * "Started" is enforced by the status machine itself (PLANNED/ASSIGNED -> COMPLETED is an
     * invalid transition, see updateRejectsPlannedStraightToCompleted). A trip that is already
     * IN_PROGRESS but carries no actualStartAt is a data anomaly, and completion deliberately
     * backfills the missing timestamp rather than refusing the driver's completion - this test
     * used to assert a "Trip must be started before completion" rejection that no longer exists.
     */
    @Test
    void completingATripWithoutAStoredActualStartBackfillsIt() {
        Trip trip = existingTrip("IN_PROGRESS");
        trip.setPlannedStartAt(OffsetDateTime.now().minusHours(3));
        trip.setActualStartAt(null);
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
        when(tripRepository.save(any(Trip.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        TripDto dto = startedTripUpdateDto("COMPLETED");
        dto.setProofOfDelivery(DELIVERY_IMAGE);

        TripDto result = tripService.update(TRIP_ID, dto);

        assertEquals("COMPLETED", result.getTripStatus());
        assertNotNull(result.getActualStartAt());
        assertNotNull(result.getCompletedAt());
        assertEquals("DELIVERED", trip.getOrder().getOrderStatus());
    }

    @Test
    void completingATripStampsCompletionAndMarksTheOrderDelivered() {
        Trip trip = startedTrip("IN_PROGRESS");
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
        when(tripRepository.save(any(Trip.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        TripDto dto = startedTripUpdateDto("COMPLETED");
        dto.setProofOfDelivery(DELIVERY_IMAGE);

        TripDto result = tripService.update(TRIP_ID, dto);

        assertEquals("COMPLETED", result.getTripStatus());
        assertNotNull(result.getCompletedAt());
        assertEquals("DELIVERED", trip.getOrder().getOrderStatus());
    }

    @Test
    void assignmentCannotBeChangedOnceTheTripHasStarted() {
        Trip trip = startedTrip("IN_PROGRESS");
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));

        TripDto dto = startedTripUpdateDto("IN_PROGRESS");
        dto.setVehicleId(UUID.randomUUID());

        assertEquals("Vehicle cannot be changed after the trip has started",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.update(TRIP_ID, dto)).getMessage());
    }

    @Test
    void theFleetOwnerCannotBeChangedOnceTheTripHasStarted() {
        Trip trip = startedTrip("IN_PROGRESS");
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));

        TripDto dto = startedTripUpdateDto("IN_PROGRESS");
        dto.setFleetOwnerId(UUID.randomUUID());

        assertEquals("Fleet owner cannot be changed after the trip has started",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.update(TRIP_ID, dto)).getMessage());
    }

    @Test
    void reassigningToABusyVehicleIsRejected() {
        when(tripRepository.findById(TRIP_ID))
                .thenReturn(Optional.of(existingTrip("PLANNED")));
        stubAssignmentUpdate();
        when(tripRepository.existsByVehicleIdAndTripStatusInAndIdNot(
                eq(VEHICLE_ID), anyCollection(), eq(TRIP_ID))).thenReturn(true);

        TripDto dto = validCreateDto();
        dto.setTripStatus("PLANNED");

        assertEquals("Selected vehicle is already assigned to another active trip",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.update(TRIP_ID, dto)).getMessage());
    }

    @Test
    void updateRejectsADuplicateTripNumber() {
        when(tripRepository.findById(TRIP_ID))
                .thenReturn(Optional.of(existingTrip("PLANNED")));
        when(tripRepository.existsByTripNumberAndIdNot("TRIP-999", TRIP_ID))
                .thenReturn(true);

        TripDto dto = validCreateDto();
        dto.setTripNumber("TRIP-999");
        dto.setTripStatus("PLANNED");

        assertThrows(DuplicateResourceException.class,
                () -> tripService.update(TRIP_ID, dto));
    }

    @Test
    void cancellingATripReleasesTheOrderBackToBookingConfirmed() {
        Trip trip = existingTrip("PLANNED");
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
        stubAssignmentUpdate();

        TripDto dto = validCreateDto();
        dto.setTripStatus("CANCELLED");

        TripDto result = tripService.update(TRIP_ID, dto);

        assertEquals("CANCELLED", result.getTripStatus());
        assertEquals("BOOKING_CONFIRMED", trip.getOrder().getOrderStatus());
    }

    @Test
    void updateThrowsWhenTheTripIsMissing() {
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.empty());

        TripDto dto = validCreateDto();
        dto.setTripStatus("ASSIGNED");

        assertEquals("Trip not found with ID: " + TRIP_ID,
                assertThrows(ResourceNotFoundException.class,
                        () -> tripService.update(TRIP_ID, dto)).getMessage());
    }

    // ---------- READ / DELETE ----------

    @Test
    void getByIdReturnsTheStoredScalarIds() {
        when(tripRepository.findById(TRIP_ID))
                .thenReturn(Optional.of(existingTrip("PLANNED")));

        TripDto result = tripService.getById(TRIP_ID);

        assertEquals(VEHICLE_ID, result.getVehicleId());
        assertEquals(DRIVER_ID, result.getDriverId());
        assertEquals(FLEET_OWNER_ID, result.getFleetOwnerId());
    }

    @Test
    void getByIdThrowsWhenTheTripIsMissing() {
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> tripService.getById(TRIP_ID));
    }

    @Test
    void anInProgressTripCannotBeDeleted() {
        when(tripRepository.findById(TRIP_ID))
                .thenReturn(Optional.of(existingTrip("IN_PROGRESS")));

        assertEquals("An in-progress trip cannot be deleted",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.delete(TRIP_ID)).getMessage());
        verify(tripRepository, never()).delete(any(Trip.class));
    }

    @Test
    void aCompletedTripCannotBeDeleted() {
        when(tripRepository.findById(TRIP_ID))
                .thenReturn(Optional.of(existingTrip("COMPLETED")));

        assertEquals("A completed trip cannot be deleted",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.delete(TRIP_ID)).getMessage());
    }

    @Test
    void aPlannedTripCanBeDeleted() {
        Trip trip = existingTrip("PLANNED");
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));

        tripService.delete(TRIP_ID);

        verify(tripRepository).delete(trip);
    }

    // ---------- DRIVER-APP LIFECYCLE ACTIONS ----------

    @Test
    void pickupArrivedAcknowledgesAnAssignedTripWithoutChangingAnyState() {
        Trip trip = existingTrip("ASSIGNED");
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));

        TripDto result = tripService.acknowledgePickupArrival(TRIP_ID);

        assertEquals("ASSIGNED", result.getTripStatus());
        assertEquals(TRIP_ID, result.getId());
        assertNull(trip.getActualStartAt());
        verify(tripRepository, never()).save(any(Trip.class));
    }

    @Test
    void pickupArrivedIsRejectedWhenTheTripIsNotYetAssigned() {
        when(tripRepository.findById(TRIP_ID))
                .thenReturn(Optional.of(existingTrip("PLANNED")));

        assertEquals("Trip must be ASSIGNED to acknowledge arrival at "
                        + "the pickup point, but it is PLANNED",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.acknowledgePickupArrival(TRIP_ID))
                        .getMessage());
    }

    @Test
    void pickupArrivedThrowsWhenTheTripIsMissing() {
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> tripService.acknowledgePickupArrival(TRIP_ID));
    }

    @Test
    void deliveryArrivedAcknowledgesAnInProgressTripWithoutChangingAnyState() {
        Trip trip = startedTrip("IN_PROGRESS");
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));

        TripDto result = tripService.acknowledgeDeliveryArrival(TRIP_ID);

        assertEquals("IN_PROGRESS", result.getTripStatus());
        assertNull(trip.getCompletedAt());
        verify(tripRepository, never()).save(any(Trip.class));
    }

    @Test
    void deliveryArrivedIsRejectedWhenTheTripHasNotStarted() {
        when(tripRepository.findById(TRIP_ID))
                .thenReturn(Optional.of(existingTrip("ASSIGNED")));

        assertEquals("Trip must be IN_PROGRESS to acknowledge arrival at "
                        + "the delivery point, but it is ASSIGNED",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.acknowledgeDeliveryArrival(TRIP_ID))
                        .getMessage());
    }

    @Test
    void confirmPickupStartsTheTripAndSynchronisesTheOrder() {
        Trip trip = existingTrip("ASSIGNED");
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
        stubAssignmentUpdate();

        TripDto result = tripService.confirmPickup(TRIP_ID, PICKUP_IMAGE);

        assertEquals("IN_PROGRESS", result.getTripStatus());
        assertEquals(PICKUP_IMAGE, result.getProofOfPickup());
        assertNotNull(result.getActualStartAt());
        assertEquals("IN_TRANSIT", trip.getOrder().getOrderStatus());
    }

    @Test
    void confirmPickupReusesTheExistingProofRequirementOfUpdate() {
        when(tripRepository.findById(TRIP_ID))
                .thenReturn(Optional.of(existingTrip("ASSIGNED")));
        stubAssignmentUpdate();

        assertEquals("Pickup image is required to start the trip",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.confirmPickup(TRIP_ID, null))
                        .getMessage());
        verify(tripRepository, never()).save(any(Trip.class));
    }

    /*
     * PLANNED -> IN_PROGRESS is a legal transition (a driver may start a trip that was never
     * separately moved to ASSIGNED, see validateStatusTransition), so the trip this test starts
     * from has to be one confirmPickup genuinely cannot start: COMPLETED is terminal.
     */
    @Test
    void confirmPickupReusesTheExistingStatusTransitionRules() {
        when(tripRepository.findById(TRIP_ID))
                .thenReturn(Optional.of(existingTrip("COMPLETED")));

        assertEquals("Invalid trip status transition from COMPLETED to IN_PROGRESS",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.confirmPickup(TRIP_ID, PICKUP_IMAGE))
                        .getMessage());
        verify(tripRepository, never()).save(any(Trip.class));
    }

    @Test
    void completeDeliveryFinishesTheTripAndMarksTheOrderDelivered() {
        Trip trip = startedTrip("IN_PROGRESS");
        trip.setDistanceKm(new BigDecimal("42.00"));
        trip.setProofOfPickup(PICKUP_IMAGE);
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
        when(tripRepository.save(any(Trip.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        TripDto result = tripService.completeDelivery(TRIP_ID, DELIVERY_IMAGE);

        assertEquals("COMPLETED", result.getTripStatus());
        assertEquals(DELIVERY_IMAGE, result.getProofOfDelivery());
        assertNotNull(result.getCompletedAt());
        assertEquals("DELIVERED", trip.getOrder().getOrderStatus());
    }

    @Test
    void completeDeliveryReusesTheExistingProofOfDeliveryRequirement() {
        Trip trip = startedTrip("IN_PROGRESS");
        trip.setDistanceKm(new BigDecimal("42.00"));
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));

        assertEquals("Delivery image is required to complete the trip",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.completeDelivery(TRIP_ID, null))
                        .getMessage());
        verify(tripRepository, never()).save(any(Trip.class));
    }

    @Test
    void completeDeliveryReusesTheExistingDistanceRequirement() {
        Trip trip = startedTrip("IN_PROGRESS");
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));

        assertEquals("Completed trip must have a valid distance",
                assertThrows(IllegalArgumentException.class,
                        () -> tripService.completeDelivery(TRIP_ID, DELIVERY_IMAGE))
                        .getMessage());
    }

    @Test
    void completeDeliveryThrowsWhenTheTripIsMissing() {
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> tripService.completeDelivery(TRIP_ID, DELIVERY_IMAGE));
    }
}
