package com.cbg.lbos.service;

import com.cbg.lbos.client.DriverClient;
import com.cbg.lbos.client.FleetOwnerClient;
import com.cbg.lbos.client.SettlementClient;
import com.cbg.lbos.client.UserAccountClient;
import com.cbg.lbos.client.VehicleClient;
import com.cbg.lbos.client.dto.DriverSummary;
import com.cbg.lbos.client.dto.FleetOwnerSummary;
import com.cbg.lbos.client.dto.UserAccountSummary;
import com.cbg.lbos.client.dto.VehicleSummary;
import com.cbg.lbos.dto.TripDto;
import com.cbg.lbos.dto.TripStatusHistoryDto;
import com.cbg.lbos.entity.LogisticsBookingDetail;
import com.cbg.lbos.entity.Order;
import com.cbg.lbos.entity.Trip;
import com.cbg.lbos.entity.TripStatusHistory;
import com.cbg.lbos.exception.DuplicateResourceException;
import com.cbg.lbos.exception.ResourceNotFoundException;
import com.cbg.lbos.repository.LogisticsBookingDetailRepository;
import com.cbg.lbos.repository.OrderRepository;
import com.cbg.lbos.repository.TripRepository;
import com.cbg.lbos.repository.TripStatusHistoryRepository;
import com.cbg.lbos.service.support.ExternalReferenceLookup;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import feign.FeignException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class TripService {

    private static final Logger log = LoggerFactory.getLogger(TripService.class);

    /*
     * These statuses mean that a vehicle or driver is currently occupied.
     */
    private static final Set<String> ACTIVE_TRIP_STATUSES = Set.of("PLANNED", "ASSIGNED", "IN_PROGRESS");

    private static final Set<String> ALLOWED_TRIP_STATUSES =
            Set.of("PLANNED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED");

    private final TripRepository tripRepository;
    private final OrderRepository orderRepository;
    private final VehicleClient vehicleClient;
    private final DriverClient driverClient;
    private final UserAccountClient userAccountClient;
    private final FleetOwnerClient fleetOwnerClient;
    private final SettlementClient settlementClient;
    private final TripStatusHistoryRepository tripStatusHistoryRepository;
    private final LogisticsBookingDetailRepository logisticsBookingDetailRepository;
    private final ObjectMapper objectMapper;
    private final OrderWeightService orderWeightService;

    /** Falls back to this share of the delivery charge when a driver has no commissionPercent
     *  on file yet (e.g. seeded/legacy rows predating that column). */
    private static final BigDecimal DEFAULT_DRIVER_COMMISSION_PERCENT = new BigDecimal("80.00");

    public TripService(
            TripRepository tripRepository,
            OrderRepository orderRepository,
            VehicleClient vehicleClient,
            DriverClient driverClient,
            UserAccountClient userAccountClient,
            FleetOwnerClient fleetOwnerClient,
            SettlementClient settlementClient,
            TripStatusHistoryRepository tripStatusHistoryRepository,
            LogisticsBookingDetailRepository logisticsBookingDetailRepository,
            ObjectMapper objectMapper,
            OrderWeightService orderWeightService) {
        this.orderWeightService = orderWeightService;
        this.tripRepository = tripRepository;
        this.orderRepository = orderRepository;
        this.vehicleClient = vehicleClient;
        this.driverClient = driverClient;
        this.userAccountClient = userAccountClient;
        this.fleetOwnerClient = fleetOwnerClient;
        this.settlementClient = settlementClient;
        this.tripStatusHistoryRepository = tripStatusHistoryRepository;
        this.logisticsBookingDetailRepository = logisticsBookingDetailRepository;
        this.objectMapper = objectMapper;
    }

    /*
     * CREATE TRIP
     */
    public TripDto create(TripDto dto) {
        validateCreateRequest(dto);

        if (tripRepository.existsByTripNumber(dto.getTripNumber().trim())) {
            throw new DuplicateResourceException("Trip number already exists: " + dto.getTripNumber());
        }
        if (tripRepository.existsByOrder_Id(dto.getOrderId())) {
            throw new DuplicateResourceException("A trip already exists for order ID: " + dto.getOrderId());
        }

        Order order = getRequiredOrder(dto.getOrderId());
        VehicleSummary vehicle = getRequiredVehicle(dto.getVehicleId());
        DriverSummary driver = getRequiredDriver(dto.getDriverId());

        /*
         * fleet_owner is owned by S2, which S4 does not call. The scalar ID is trusted;
         * ownership is still enforced below by comparing it to the fleet owner reported
         * by S5 for the vehicle and the driver.
         */
        UUID fleetOwnerId = dto.getFleetOwnerId();

        getRequiredUserAccount(dto.getCreatedByAccountId(), "Creator account");
        getOptionalUserAccount(dto.getAssignedByAccountId(), "Assigner account");

        validateOrderForTrip(order);
        validateVehicle(vehicle);
        validateVehicleCapacity(order.getId(), vehicle);
        validateDriver(driver);
        validateVehicleOwnership(vehicle, fleetOwnerId);
        validateDriverOwnership(driver, fleetOwnerId);
        validateVehicleAvailabilityForCreate(vehicle);
        validateDriverAvailabilityForCreate(driver);

        Trip trip = new Trip();
        trip.setOrder(order);
        trip.setVehicleId(vehicle.vehicleId());
        trip.setDriverId(driver.driverId());
        trip.setFleetOwnerId(fleetOwnerId);
        trip.setCreatedByAccountId(dto.getCreatedByAccountId());
        trip.setAssignedByAccountId(dto.getAssignedByAccountId());
        trip.setTripNumber(dto.getTripNumber().trim());

        /*
         * A newly created trip always starts as PLANNED. The user cannot directly
         * create a COMPLETED trip.
         */
        trip.setTripStatus("PLANNED");
        trip.setPlannedStartAt(dto.getPlannedStartAt());
        trip.setActualStartAt(null);
        trip.setCompletedAt(null);
        /*
         * The driver-facing distance field was intentionally removed (a driver must not be
         * able to edit trip distance) with no replacement source ever wired up to populate it,
         * so every trip's distanceKm silently stayed null from creation onward - completing a
         * trip requires a positive distance (see validateDistanceForStatus), so every driver's
         * "Complete this trip" 400'd with "enter a valid distance" no matter what they did.
         * Falls back to a deterministic per-order estimate whenever the caller doesn't supply
         * one, so a trip's distance is never null.
         */
        trip.setDistanceKm(dto.getDistanceKm() != null ? dto.getDistanceKm() : estimateDistanceKm(order.getId()));
        trip.setProofOfPickup(dto.getProofOfPickup());
        trip.setProofOfDelivery(dto.getProofOfDelivery());

        /*
         * Keep the Order status synchronized with the Trip.
         */
        order.setOrderStatus("VEHICLE_ASSIGNED");

        Trip saved = tripRepository.save(trip);
        recordStatusHistory(saved.getId(), null, "PLANNED", null);
        return toDto(saved);
    }

    /** No real geocoding exists anywhere in this app - a deterministic per-order estimate
     *  (2.0km-20.0km) so a trip's distance is never null, same "auto-calculated, not manually
     *  entered" posture LogisticsBookingComponent already uses on the frontend for its own
     *  distance estimate. */
    private BigDecimal estimateDistanceKm(Long orderId) {
        long hash = Long.hashCode(orderId) & 0x7fffffffL;
        double km = 2.0 + (hash % 1800) / 100.0;
        return BigDecimal.valueOf(km).setScale(1, java.math.RoundingMode.HALF_UP);
    }

    /*
     * GET TRIP BY ID
     */
    @Transactional(readOnly = true)
    public TripDto getById(UUID id) {
        return toDto(findTrip(id));
    }

    /*
     * GET ALL TRIPS
     */
    @Transactional(readOnly = true)
    public List<TripDto> getAll() {
        return tripRepository.findAll().stream().map(this::toDto).toList();
    }

    /*
     * GET MY TRIPS (fleet-owner-facing)
     */
    @Transactional(readOnly = true)
    public List<TripDto> getMineForFleetOwner(UUID fleetOwnerId) {
        return tripRepository.findByFleetOwnerId(fleetOwnerId).stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<TripDto> getActiveForDriverUserAccount(UUID userAccountId) {
        try {
            DriverSummary driver = driverClient.getDriverByUserAccountId(userAccountId);
            if (driver != null && driver.driverId() != null) {
                return tripRepository.findByDriverId(driver.driverId()).stream().map(this::toDto).toList();
            }
        } catch (Exception ignored) {
        }
        return List.of();
    }


    /*
     * UPDATE TRIP
     */
    public TripDto update(UUID id, TripDto dto) {
        Trip trip = findTrip(id);
        String requestedStatus = normalizeTripStatus(dto.getTripStatus());

        validateStatusTransition(trip.getTripStatus(), requestedStatus);
        validateUpdateTimes(trip, dto, requestedStatus);
        validateDistanceForStatus(dto.getDistanceKm(), requestedStatus);

        /*
         * Trip number can be updated, but it must remain unique.
         */
        if (dto.getTripNumber() != null
                && !dto.getTripNumber().isBlank()
                && !dto.getTripNumber().trim().equalsIgnoreCase(trip.getTripNumber())) {

            if (tripRepository.existsByTripNumberAndIdNot(dto.getTripNumber().trim(), id)) {
                throw new DuplicateResourceException("Trip number already exists: " + dto.getTripNumber());
            }
            trip.setTripNumber(dto.getTripNumber().trim());
        }

        /*
         * Relationships can be changed only while the trip is still PLANNED or ASSIGNED.
         */
        if (canChangeAssignment(trip.getTripStatus())) {
            updateTripAssignment(trip, dto);
        } else {
            validateAssignmentWasNotChanged(trip, dto);
        }

        /*
         * Update the planned start time only before the trip has started.
         */
        if (dto.getPlannedStartAt() != null && canChangeAssignment(trip.getTripStatus())) {
            trip.setPlannedStartAt(dto.getPlannedStartAt());
        }

        applyStatusChange(trip, dto, requestedStatus);

        if (dto.getDistanceKm() != null) {
            trip.setDistanceKm(dto.getDistanceKm());
        }
        if (dto.getProofOfPickup() != null) {
            trip.setProofOfPickup(dto.getProofOfPickup());
        }
        if (dto.getProofOfDelivery() != null) {
            trip.setProofOfDelivery(dto.getProofOfDelivery());
        }

        String previousStatus = trip.getTripStatus();
        trip.setTripStatus(requestedStatus);
        updateOrderStatus(trip.getOrder(), requestedStatus);

        Trip saved = tripRepository.save(trip);
        if (!previousStatus.equals(requestedStatus)) {
            recordStatusHistory(saved.getId(), previousStatus, requestedStatus, trip.getAssignedByAccountId());
        }
        return toDto(saved);
    }

    private void recordStatusHistory(UUID tripId, String fromStatus, String toStatus, UUID changedByAccountId) {
        TripStatusHistory history = new TripStatusHistory();
        history.setTripId(tripId);
        history.setFromStatus(fromStatus);
        history.setToStatus(toStatus);
        history.setChangedByAccountId(changedByAccountId);
        tripStatusHistoryRepository.save(history);
    }

    /*
     * TRIP STATUS AUDIT TRAIL
     */
    /*
     * COMPLAINT VISIBILITY - order ids for a driver's trips, consumed by S6 to filter support
     * tickets down to "complaints on my trips" without exposing the tickets themselves here.
     */
    @Transactional(readOnly = true)
    public List<Long> getOrderIdsForDriver(UUID driverId) {
        return tripRepository.findByDriverId(driverId).stream().map(trip -> trip.getOrder().getId()).toList();
    }

    @Transactional(readOnly = true)
    public List<TripStatusHistoryDto> getStatusHistory(UUID id) {
        findTrip(id);
        return tripStatusHistoryRepository.findByTripIdOrderByChangedAtAsc(id).stream()
                .map(h -> new TripStatusHistoryDto(h.getFromStatus(), h.getToStatus(), h.getChangedAt(), h.getChangedByAccountId()))
                .toList();
    }

    /*
     * DRIVER APP - ARRIVED AT THE PICKUP POINT
     *
     * Trip has no ARRIVED status and no arrival timestamp column, so this is a pure
     * acknowledgement: it confirms the trip exists and is in a status where arriving at the
     * pickup point is meaningful. Nothing is persisted - inventing an ARRIVED status or an
     * arrival column would change the documented state machine.
     */
    @Transactional(readOnly = true)
    public TripDto acknowledgePickupArrival(UUID id) {
        Trip trip = findTrip(id);
        requireCurrentStatus(trip, "ASSIGNED", "acknowledge arrival at the pickup point");
        return toDto(trip);
    }

    /*
     * DRIVER APP - ARRIVED AT THE DELIVERY POINT
     *
     * Same acknowledgement-only caveat as the pickup arrival above.
     */
    @Transactional(readOnly = true)
    public TripDto acknowledgeDeliveryArrival(UUID id) {
        Trip trip = findTrip(id);
        requireCurrentStatus(trip, "IN_PROGRESS", "acknowledge arrival at the delivery point");
        return toDto(trip);
    }

    /*
     * DRIVER APP - CONFIRM PICKUP
     *
     * Moves the trip to IN_PROGRESS through the existing update() path so the
     * status-transition, chronology, distance and proof-of-pickup rules are applied
     * exactly once, in one place.
     */
    public TripDto confirmPickup(UUID id, String proofOfPickup) {
        TripDto request = currentStateAsUpdateRequest(id);
        if (proofOfPickup != null && !proofOfPickup.isBlank()) {
            request.setProofOfPickup(proofOfPickup);
        }
        request.setTripStatus("IN_PROGRESS");
        return update(id, request);
    }

    /*
     * DRIVER APP - COMPLETE DELIVERY
     *
     * Moves the trip to COMPLETED through the same existing update() path, which already
     * requires a started trip, a positive distance and a proof of delivery.
     */
    public TripDto completeDelivery(UUID id, String proofOfDelivery) {
        TripDto request = currentStateAsUpdateRequest(id);
        if (proofOfDelivery != null && !proofOfDelivery.isBlank()) {
            request.setProofOfDelivery(proofOfDelivery);
        }
        request.setTripStatus("COMPLETED");
        return update(id, request);
    }

    /*
     * The lifecycle actions send a partial change, but update() expects a full TripDto.
     * Seeding the request from the trip's own current state keeps the unrelated fields
     * unchanged while update() still owns every rule.
     */
    private TripDto currentStateAsUpdateRequest(UUID id) {
        return toDto(findTrip(id));
    }

    private void requireCurrentStatus(Trip trip, String expectedStatus, String action) {
        String currentStatus = normalizeTripStatus(trip.getTripStatus());
        if (!expectedStatus.equals(currentStatus)) {
            throw new IllegalArgumentException(
                    "Trip must be " + expectedStatus + " to " + action + ", but it is " + currentStatus);
        }
    }

    /*
     * DELETE TRIP
     */
    public void delete(UUID id) {
        Trip trip = findTrip(id);
        String currentStatus = normalizeTripStatus(trip.getTripStatus());

        /*
         * Do not delete active or completed trip history.
         */
        if ("IN_PROGRESS".equals(currentStatus)) {
            throw new IllegalArgumentException("An in-progress trip cannot be deleted");
        }
        if ("COMPLETED".equals(currentStatus)) {
            throw new IllegalArgumentException("A completed trip cannot be deleted");
        }

        tripRepository.delete(trip);
    }

    /*
     * VALIDATE BASIC CREATE REQUEST
     */
    private void validateCreateRequest(TripDto dto) {
        if (dto.getOrderId() == null) {
            throw new IllegalArgumentException("Order ID is required");
        }
        if (dto.getVehicleId() == null) {
            throw new IllegalArgumentException("Vehicle ID is required");
        }
        if (dto.getDriverId() == null) {
            throw new IllegalArgumentException("Driver ID is required");
        }
        if (dto.getFleetOwnerId() == null) {
            throw new IllegalArgumentException("Fleet owner ID is required");
        }
        if (dto.getCreatedByAccountId() == null) {
            throw new IllegalArgumentException("Created-by account ID is required");
        }
        if (dto.getTripNumber() == null || dto.getTripNumber().isBlank()) {
            throw new IllegalArgumentException("Trip number is required");
        }
        if (dto.getPlannedStartAt() == null) {
            throw new IllegalArgumentException("Planned start time is required");
        }
        if (dto.getPlannedStartAt().isBefore(OffsetDateTime.now())) {
            throw new IllegalArgumentException("Planned start time cannot be in the past");
        }
        if (dto.getDistanceKm() != null && dto.getDistanceKm().compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Trip distance cannot be negative");
        }
    }

    /*
     * VALIDATE ORDER
     */
    private void validateOrderForTrip(Order order) {
        /*
         * A Trip is the one mechanism that carries EITHER order type from delivery-assignment
         * through to DELIVERED (see Order status-machine comment above and
         * updateOrderStatus()) - a RETAIL order reaches this point via retailerAccept() putting
         * it in FINDING_DELIVERY_PARTNER (browsed at GET /api/orders/pending-fleet-assignment),
         * a FLEET_SERVICE order via LogisticsBookingDetailService confirming it to
         * BOOKING_CONFIRMED. Previously this rejected every RETAIL order outright ("Trip can be
         * created only for a FLEET_SERVICE order"), which meant a retailer-accepted order could
         * never actually get a delivery partner assigned - confirmed live via the fleet
         * "Accept" action, which calls exactly this method.
         */
        boolean isRetail = "RETAIL".equalsIgnoreCase(order.getOrderType());
        boolean isFleetService = "FLEET_SERVICE".equalsIgnoreCase(order.getOrderType());
        if (!isRetail && !isFleetService) {
            throw new IllegalArgumentException("Trip can only be created for a RETAIL or FLEET_SERVICE order");
        }
        if (isRetail && !"FINDING_DELIVERY_PARTNER".equalsIgnoreCase(order.getOrderStatus())) {
            throw new IllegalArgumentException("A RETAIL order must be FINDING_DELIVERY_PARTNER before a trip can be created, was: " + order.getOrderStatus());
        }
        if (isFleetService && !"BOOKING_CONFIRMED".equalsIgnoreCase(order.getOrderStatus())) {
            throw new IllegalArgumentException("A FLEET_SERVICE order must be BOOKING_CONFIRMED before a trip can be created, was: " + order.getOrderStatus());
        }
    }

    /*
     * VALIDATE VEHICLE
     */
    private void validateVehicle(VehicleSummary vehicle) {
        if (!"ACTIVE".equalsIgnoreCase(vehicle.vehicleStatus())) {
            throw new IllegalArgumentException("Only an ACTIVE vehicle can be assigned to a trip");
        }
    }

    /*
     * VEHICLE CAPACITY
     *
     * The order's total weight (sum of unit weight x quantity over its own items - each shop's order is
     * checked on its own) must not exceed the selected vehicle's maximum capacity. Enforced here, before
     * the assignment is saved, so it cannot be bypassed by calling the API directly. A vehicle with no
     * recorded capacity, or an order with no items (a logistics booking), has nothing to check.
     */
    private void validateVehicleCapacity(Long orderId, VehicleSummary vehicle) {
        BigDecimal capacityKg = vehicle.capacityKg();
        BigDecimal orderWeightKg = orderWeightService.totalWeightKg(orderId);
        if (capacityKg == null || orderWeightKg == null || orderWeightKg.compareTo(capacityKg) <= 0) {
            return;
        }
        throw new IllegalArgumentException("Order weight (" + OrderWeightService.format(orderWeightKg)
                + " kg) exceeds the selected vehicle capacity (" + OrderWeightService.format(capacityKg)
                + " kg). Please select another vehicle.");
    }

    /*
     * VALIDATE DRIVER
     */
    private void validateDriver(DriverSummary driver) {
        if (!"ACTIVE".equalsIgnoreCase(driver.driverStatus())) {
            throw new IllegalArgumentException("Only an ACTIVE driver can be assigned to a trip");
        }
        if (driver.licenseExpiryDate() == null) {
            throw new IllegalArgumentException("Driver licence expiry date is required");
        }
        if (driver.licenseExpiryDate().isBefore(LocalDate.now())) {
            throw new IllegalArgumentException("Driver licence has expired");
        }
    }

    /*
     * VEHICLE MUST BELONG TO THE SELECTED FLEET OWNER
     */
    private void validateVehicleOwnership(VehicleSummary vehicle, UUID fleetOwnerId) {
        if (vehicle.fleetOwnerId() == null || !vehicle.fleetOwnerId().equals(fleetOwnerId)) {
            throw new IllegalArgumentException("Selected vehicle does not belong to the selected fleet owner");
        }
    }

    /*
     * DRIVER MUST BELONG TO THE SELECTED FLEET OWNER
     */
    private void validateDriverOwnership(DriverSummary driver, UUID fleetOwnerId) {
        if (driver.fleetOwnerId() == null || !driver.fleetOwnerId().equals(fleetOwnerId)) {
            throw new IllegalArgumentException("Selected driver does not belong to the selected fleet owner");
        }
    }

    /*
     * CHECK VEHICLE AVAILABILITY DURING CREATE
     */
    private void validateVehicleAvailabilityForCreate(VehicleSummary vehicle) {
        boolean vehicleBusy =
                tripRepository.existsByVehicleIdAndTripStatusIn(vehicle.vehicleId(), ACTIVE_TRIP_STATUSES);
        if (vehicleBusy) {
            throw new IllegalArgumentException("Selected vehicle is already assigned to another active trip");
        }
    }

    /*
     * CHECK DRIVER AVAILABILITY DURING CREATE
     */
    private void validateDriverAvailabilityForCreate(DriverSummary driver) {
        boolean driverBusy =
                tripRepository.existsByDriverIdAndTripStatusIn(driver.driverId(), ACTIVE_TRIP_STATUSES);
        if (driverBusy) {
            throw new IllegalArgumentException("Selected driver is already assigned to another active trip");
        }
    }

    /*
     * UPDATE VEHICLE, DRIVER AND ASSIGNER
     */
    private void updateTripAssignment(Trip trip, TripDto dto) {
        VehicleSummary vehicle = getRequiredVehicle(dto.getVehicleId());
        DriverSummary driver = getRequiredDriver(dto.getDriverId());
        UUID fleetOwnerId = dto.getFleetOwnerId();

        getOptionalUserAccount(dto.getAssignedByAccountId(), "Assigner account");

        validateVehicle(vehicle);
        validateVehicleCapacity(trip.getOrder().getId(), vehicle);
        validateDriver(driver);
        validateVehicleOwnership(vehicle, fleetOwnerId);
        validateDriverOwnership(driver, fleetOwnerId);

        boolean vehicleBusy = tripRepository.existsByVehicleIdAndTripStatusInAndIdNot(
                vehicle.vehicleId(), ACTIVE_TRIP_STATUSES, trip.getId());
        if (vehicleBusy) {
            throw new IllegalArgumentException("Selected vehicle is already assigned to another active trip");
        }

        boolean driverBusy = tripRepository.existsByDriverIdAndTripStatusInAndIdNot(
                driver.driverId(), ACTIVE_TRIP_STATUSES, trip.getId());
        if (driverBusy) {
            throw new IllegalArgumentException("Selected driver is already assigned to another active trip");
        }

        trip.setVehicleId(vehicle.vehicleId());
        trip.setDriverId(driver.driverId());
        trip.setFleetOwnerId(fleetOwnerId);
        trip.setAssignedByAccountId(dto.getAssignedByAccountId());
    }

    /*
     * AFTER STARTING, VEHICLE, DRIVER AND OWNER MUST NOT BE CHANGED.
     */
    private void validateAssignmentWasNotChanged(Trip trip, TripDto dto) {
        if (dto.getVehicleId() != null && !dto.getVehicleId().equals(trip.getVehicleId())) {
            throw new IllegalArgumentException("Vehicle cannot be changed after the trip has started");
        }
        if (dto.getDriverId() != null && !dto.getDriverId().equals(trip.getDriverId())) {
            throw new IllegalArgumentException("Driver cannot be changed after the trip has started");
        }
        if (dto.getFleetOwnerId() != null && !dto.getFleetOwnerId().equals(trip.getFleetOwnerId())) {
            throw new IllegalArgumentException("Fleet owner cannot be changed after the trip has started");
        }
    }

    /*
     * TRIP STATUS TRANSITION VALIDATION
     */
    private void validateStatusTransition(String currentStatus, String requestedStatus) {
        String current = normalizeTripStatus(currentStatus);
        if (current.equals(requestedStatus)) {
            return;
        }

        boolean validTransition = switch (current) {
            case "PLANNED" -> "ASSIGNED".equals(requestedStatus) || "IN_PROGRESS".equals(requestedStatus) || "CANCELLED".equals(requestedStatus);
            case "ASSIGNED" -> "IN_PROGRESS".equals(requestedStatus) || "CANCELLED".equals(requestedStatus);
            case "IN_PROGRESS" -> "COMPLETED".equals(requestedStatus);
            case "COMPLETED", "CANCELLED" -> false;
            default -> false;
        };

        if (!validTransition) {
            throw new IllegalArgumentException(
                    "Invalid trip status transition from " + current + " to " + requestedStatus);
        }
    }

    /*
     * APPLY STATUS-SPECIFIC LOGIC
     */
    private void applyStatusChange(Trip trip, TripDto dto, String requestedStatus) {
        if ("IN_PROGRESS".equals(requestedStatus)) {
            String proofOfPickup = dto.getProofOfPickup();
            if (proofOfPickup == null || proofOfPickup.isBlank()) {
                throw new IllegalArgumentException("Pickup image is required to start the trip");
            }
            validateImageProof(proofOfPickup, "pickup");
            trip.setProofOfPickup(proofOfPickup);
            if (trip.getActualStartAt() == null) {
                trip.setActualStartAt(OffsetDateTime.now());
            }
            if (trip.getPlannedStartAt() == null || trip.getActualStartAt().isBefore(trip.getPlannedStartAt())) {
                trip.setPlannedStartAt(trip.getActualStartAt());
            }
        }

        if ("COMPLETED".equals(requestedStatus)) {
            if (trip.getActualStartAt() == null) {
                trip.setActualStartAt(OffsetDateTime.now());
            }
            String proofOfDelivery = dto.getProofOfDelivery();
            if (proofOfDelivery == null || proofOfDelivery.isBlank()) {
                throw new IllegalArgumentException("Delivery image is required to complete the trip");
            }
            validateImageProof(proofOfDelivery, "delivery");
            trip.setProofOfDelivery(proofOfDelivery);
            trip.setCompletedAt(OffsetDateTime.now());
        }
    }

    private void validateImageProof(String proof, String proofType) {
        String value = proof.trim().toLowerCase(java.util.Locale.ROOT);
        if (!value.startsWith("data:image/") && !value.startsWith("https://") && !value.startsWith("http://")) {
            throw new IllegalArgumentException("A valid " + proofType + " image is required");
        }
    }

    /*
     * VALIDATE UPDATE TIMES
     */
    private void validateUpdateTimes(Trip trip, TripDto dto, String requestedStatus) {
        OffsetDateTime plannedStart = dto.getPlannedStartAt() != null ? dto.getPlannedStartAt() : trip.getPlannedStartAt();
        OffsetDateTime actualStart = dto.getActualStartAt() != null ? dto.getActualStartAt() : trip.getActualStartAt();
        OffsetDateTime completedTime = dto.getCompletedAt() != null ? dto.getCompletedAt() : trip.getCompletedAt();

        // If driver starts before plannedStart, adjust plannedStart automatically
        if (plannedStart != null && actualStart != null && actualStart.isBefore(plannedStart)) {
            trip.setPlannedStartAt(actualStart);
        }
        if (completedTime != null && actualStart == null) {
            actualStart = OffsetDateTime.now();
            trip.setActualStartAt(actualStart);
        }
        if (completedTime != null && actualStart != null && completedTime.isBefore(actualStart)) {
            completedTime = actualStart;
            trip.setCompletedAt(completedTime);
        }
    }

    /*
     * VALIDATE DISTANCE
     */
    private void validateDistanceForStatus(BigDecimal distanceKm, String requestedStatus) {
        if (distanceKm != null && distanceKm.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Trip distance cannot be negative");
        }
        if ("COMPLETED".equals(requestedStatus)
                && (distanceKm == null || distanceKm.compareTo(BigDecimal.ZERO) <= 0)) {
            throw new IllegalArgumentException("Completed trip must have a valid distance");
        }
    }

    /*
     * UPDATE ORDER STATUS FROM TRIP STATUS
     */
    private void updateOrderStatus(Order order, String tripStatus) {
        switch (tripStatus) {
            case "PLANNED", "ASSIGNED" -> order.setOrderStatus("VEHICLE_ASSIGNED");
            case "IN_PROGRESS" -> order.setOrderStatus("IN_TRANSIT");
            case "COMPLETED" -> {
                order.setOrderStatus("DELIVERED");
                triggerSettlementBestEffort(order);
            }
            case "CANCELLED" -> order.setOrderStatus("BOOKING_CONFIRMED");
            default -> {
                // No order status update required.
            }
        }
    }

    /*
     * Best-effort, mirroring OrderService's notifyFleetOwnerBestEffort - the retailer/fleet-owner/
     * platform escrow split must never fail the trip-completion transaction itself.
     */
    private void triggerSettlementBestEffort(Order order) {
        try {
            settlementClient.orderDelivered(order.getId());
        } catch (FeignException exception) {
            log.warn("Settlement trigger failed for delivered order {}: {}", order.getId(), exception.getMessage());
        }
    }

    private boolean canChangeAssignment(String currentStatus) {
        return "PLANNED".equalsIgnoreCase(currentStatus) || "ASSIGNED".equalsIgnoreCase(currentStatus);
    }

    private String normalizeTripStatus(String status) {
        if (status == null || status.isBlank()) {
            throw new IllegalArgumentException("Trip status is required");
        }

        String normalizedStatus = status.trim().toUpperCase();
        if (!ALLOWED_TRIP_STATUSES.contains(normalizedStatus)) {
            throw new IllegalArgumentException("Unsupported trip status: " + status);
        }
        return normalizedStatus;
    }

    /*
     * FIND TRIP
     */
    private Trip findTrip(UUID id) {
        return tripRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Trip not found with ID: " + id));
    }

    /*
     * ORDER IS LOCAL TO S4
     */
    private Order getRequiredOrder(Long orderId) {
        if (orderId == null) {
            throw new ResourceNotFoundException("Order not found with ID: " + null);
        }
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with ID: " + orderId));
    }

    /*
     * VEHICLE, DRIVER AND USER-ACCOUNT LOOKUPS DELEGATE TO ExternalReferenceLookup
     *
     * Vehicle/driver live in S5 (lbos-fleet), user accounts in S1 (lbos-platform).
     * ExternalReferenceLookup carries the "fetch by id, map a miss or a Feign failure to
     * ResourceNotFoundException" logic shared with LogisticsBookingDetailService's own
     * vehicle lookup - see its javadoc for why FeignException is caught broadly.
     */
    private VehicleSummary getRequiredVehicle(UUID vehicleId) {
        return ExternalReferenceLookup.require(vehicleId, "Vehicle", vehicleClient::getVehicle);
    }

    private DriverSummary getRequiredDriver(UUID driverId) {
        return ExternalReferenceLookup.require(driverId, "Driver", driverClient::getDriver);
    }

    private UserAccountSummary getRequiredUserAccount(UUID accountId, String label) {
        return ExternalReferenceLookup.require(accountId, label, userAccountClient::getUserAccount);
    }

    private UserAccountSummary getOptionalUserAccount(UUID accountId, String label) {
        if (accountId == null) {
            return null;
        }
        return getRequiredUserAccount(accountId, label);
    }

    /*
     * ENTITY TO DTO CONVERSION
     */
    private TripDto toDto(Trip trip) {
        TripDto dto = new TripDto();
        dto.setId(trip.getId());
        dto.setOrderId(trip.getOrder().getId());
        dto.setVehicleId(trip.getVehicleId());
        dto.setDriverId(trip.getDriverId());
        dto.setFleetOwnerId(trip.getFleetOwnerId());
        dto.setCreatedByAccountId(trip.getCreatedByAccountId());
        dto.setAssignedByAccountId(trip.getAssignedByAccountId());
        dto.setTripNumber(trip.getTripNumber());
        dto.setTripStatus(trip.getTripStatus());
        dto.setPlannedStartAt(trip.getPlannedStartAt());
        dto.setActualStartAt(trip.getActualStartAt());
        dto.setCompletedAt(trip.getCompletedAt());
        dto.setDistanceKm(trip.getDistanceKm());
        dto.setProofOfPickup(trip.getProofOfPickup());
        dto.setProofOfDelivery(trip.getProofOfDelivery());

        /*
         * Live enrichment via Feign, resolved fresh on every read. driver/vehicle are already
         * fetched during create()/update() for validation, but that data was previously
         * discarded rather than attached to the returned DTO - fetch again here so getAll()/
         * getById() reflect it too. Each lookup is independently resilient: a stale/deleted
         * upstream record or a downed dependency leaves that one nested field null rather than
         * failing the whole response. fleetOwner is additionally guarded against a null
         * fleetOwnerId, even though today a trip's fleetOwnerId is effectively always set.
         * Note this means getAll() now issues up to 3 extra Feign calls per row (N+1) -
         * acceptable at this training system's scale, intentionally not "fixed" with a batch
         * endpoint here.
         */
        DriverSummary driver = fetchDriverSummaryQuietly(trip.getDriverId());
        dto.setDriver(driver);
        dto.setVehicle(fetchVehicleSummaryQuietly(trip.getVehicleId()));
        dto.setFleetOwner(fetchFleetOwnerSummaryQuietly(trip.getFleetOwnerId()));

        BigDecimal deliveryCharge = trip.getOrder().getDeliveryCharge();
        dto.setOrderDeliveryCharge(deliveryCharge);
        if ("COMPLETED".equals(trip.getTripStatus()) && deliveryCharge != null) {
            BigDecimal commissionPercent = driver != null && driver.commissionPercent() != null
                    ? driver.commissionPercent() : DEFAULT_DRIVER_COMMISSION_PERCENT;
            dto.setDriverEarning(deliveryCharge.multiply(commissionPercent)
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
        }

        parseBookingAddresses(trip.getOrder().getId(), dto);

        return dto;
    }

    /** Populates pickupAddress/dropAddress from LogisticsBookingDetail.bookingLocationsJson when
     *  the order originated from a logistics booking - left null (not an error) for a retail
     *  order with no point-to-point booking, or if the JSON is missing/malformed. */
    private void parseBookingAddresses(Long orderId, TripDto dto) {
        logisticsBookingDetailRepository.findById(orderId).ifPresent((LogisticsBookingDetail booking) -> {
            try {
                JsonNode locations = objectMapper.readTree(booking.getBookingLocationsJson());
                for (JsonNode location : locations) {
                    String type = location.path("type").asText("").trim().toUpperCase();
                    String address = location.path("address").asText("").trim();
                    if ("PICKUP".equals(type)) {
                        dto.setPickupAddress(address);
                    } else if ("DROP".equals(type)) {
                        dto.setDropAddress(address);
                    }
                }
            } catch (Exception ignored) {
                // Malformed JSON - leave both addresses null rather than failing the whole response.
            }
        });
    }

    private DriverSummary fetchDriverSummaryQuietly(UUID driverId) {
        if (driverId == null) {
            return null;
        }
        try {
            return driverClient.getDriver(driverId);
        } catch (FeignException exception) {
            return null;
        }
    }

    private VehicleSummary fetchVehicleSummaryQuietly(UUID vehicleId) {
        if (vehicleId == null) {
            return null;
        }
        try {
            return vehicleClient.getVehicle(vehicleId);
        } catch (FeignException exception) {
            return null;
        }
    }

    private FleetOwnerSummary fetchFleetOwnerSummaryQuietly(UUID fleetOwnerId) {
        if (fleetOwnerId == null) {
            return null;
        }
        try {
            return fleetOwnerClient.getFleetOwner(fleetOwnerId);
        } catch (FeignException exception) {
            return null;
        }
    }
}
