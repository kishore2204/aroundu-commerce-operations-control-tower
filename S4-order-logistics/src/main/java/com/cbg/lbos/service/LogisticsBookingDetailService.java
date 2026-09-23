package com.cbg.lbos.service;

import com.cbg.lbos.client.VehicleClient;
import com.cbg.lbos.client.dto.VehicleSummary;
import com.cbg.lbos.dto.LogisticsBookingDetailDto;
import com.cbg.lbos.entity.LogisticsBookingDetail;
import com.cbg.lbos.entity.Order;
import com.cbg.lbos.exception.ResourceNotFoundException;
import com.cbg.lbos.repository.LogisticsBookingDetailRepository;
import com.cbg.lbos.repository.OrderRepository;
import com.cbg.lbos.service.support.ExternalReferenceLookup;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import com.cbg.lbos.dto.LogisticsQuoteRequest;
import com.cbg.lbos.dto.LogisticsQuoteResponse;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class LogisticsBookingDetailService {

    private static final BigDecimal BASE_CHARGE = new BigDecimal("100.00");
    private static final BigDecimal DISTANCE_RATE_PER_KM = new BigDecimal("15.00");
    private static final BigDecimal ADDITIONAL_STOP_RATE = new BigDecimal("50.00");
    private static final BigDecimal HANDLING_CHARGE = new BigDecimal("100.00");
    private static final BigDecimal LAST_MILE_CHARGE = new BigDecimal("150.00");
    private static final BigDecimal PRIORITY_PERCENTAGE = new BigDecimal("0.20");

    private final LogisticsBookingDetailRepository bookingRepository;
    private final OrderRepository orderRepository;
    private final VehicleClient vehicleClient;
    private final ObjectMapper objectMapper;
    private final LogisticsRateService logisticsRateService;

    public LogisticsBookingDetailService(
            LogisticsBookingDetailRepository bookingRepository,
            OrderRepository orderRepository,
            VehicleClient vehicleClient,
            ObjectMapper objectMapper,
            LogisticsRateService logisticsRateService) {
        this.bookingRepository = bookingRepository;
        this.orderRepository = orderRepository;
        this.vehicleClient = vehicleClient;
        this.objectMapper = objectMapper;
        this.logisticsRateService = logisticsRateService;
    }

    public LogisticsBookingDetailDto create(LogisticsBookingDetailDto dto) {
        validateDto(dto);

        if (bookingRepository.existsById(dto.getOrderId())) {
            throw new IllegalArgumentException(
                    "Logistics booking already exists for order ID: " + dto.getOrderId());
        }

        Order order = findRequiredOrder(dto.getOrderId());
        validateOrder(order);
        validateReceiver(dto);

        int locationCount = validateLocationsAndGetCount(dto.getBookingLocationsJson());

        VehicleSummary vehicle = fetchOptionalVehicle(dto.getVehicleReferenceId());

        LogisticsBookingDetail booking = new LogisticsBookingDetail();
        copyDtoToEntity(dto, booking, order, vehicle);

        BigDecimal estimatedLogisticsCost = calculateEstimatedLogisticsCost(
                dto.getEstimatedDistanceKm(),
                locationCount,
                dto.getBookingType(),
                vehicle,
                dto.isSpecialHandlingRequired(),
                dto.isPriorityDelivery(),
                dto.isLastMileDeliveryRequired());

        updateOrderAmounts(order, estimatedLogisticsCost);
        LogisticsBookingDetail savedBooking = bookingRepository.save(booking);

        LogisticsBookingDetailDto response = toDto(savedBooking);
        copyCalculationInputs(dto, response);
        response.setEstimatedLogisticsCost(estimatedLogisticsCost);
        return response;
    }

    /**
     * The price of a booking BEFORE it is created - the very calculation {@link #create} stores on the order, so the
     * amount the customer sees on the payment screen is the amount that is charged and shown on the order afterwards.
     * A customer's booking has two locations (pickup, drop) and no discount / product subtotal, so the total is the
     * logistics charge.
     */
    @Transactional(readOnly = true)
    public LogisticsQuoteResponse quote(LogisticsQuoteRequest request) {
        if (request == null || request.bookingType() == null || request.bookingType().isBlank()) {
            throw new IllegalArgumentException("Booking type is required");
        }
        BigDecimal charge = calculateEstimatedLogisticsCost(request.estimatedDistanceKm(), 2, request.bookingType(), null,
                Boolean.TRUE.equals(request.specialHandlingRequired()), Boolean.TRUE.equals(request.priorityDelivery()),
                Boolean.TRUE.equals(request.lastMileDeliveryRequired()));
        return new LogisticsQuoteResponse(charge, charge);
    }

    @Transactional(readOnly = true)
    public LogisticsBookingDetailDto getById(Long orderId) {
        LogisticsBookingDetail booking = findBooking(orderId);
        LogisticsBookingDetailDto response = toDto(booking);
        response.setEstimatedLogisticsCost(booking.getOrder().getDeliveryCharge());
        return response;
    }

    @Transactional(readOnly = true)
    public List<LogisticsBookingDetailDto> getAll() {
        return bookingRepository.findAll().stream()
                .map(booking -> {
                    LogisticsBookingDetailDto dto = toDto(booking);
                    dto.setEstimatedLogisticsCost(booking.getOrder().getDeliveryCharge());
                    return dto;
                })
                .toList();
    }

    public LogisticsBookingDetailDto update(Long orderId, LogisticsBookingDetailDto dto) {
        validateDto(dto);

        if (!orderId.equals(dto.getOrderId())) {
            throw new IllegalArgumentException(
                    "Order ID in URL and request body must be the same");
        }

        LogisticsBookingDetail booking = findBooking(orderId);
        validateReceiver(dto);
        int locationCount = validateLocationsAndGetCount(dto.getBookingLocationsJson());

        VehicleSummary vehicle = fetchOptionalVehicle(dto.getVehicleReferenceId());

        copyDtoToEntity(dto, booking, booking.getOrder(), vehicle);

        BigDecimal estimatedLogisticsCost = calculateEstimatedLogisticsCost(
                dto.getEstimatedDistanceKm(),
                locationCount,
                dto.getBookingType(),
                vehicle,
                dto.isSpecialHandlingRequired(),
                dto.isPriorityDelivery(),
                dto.isLastMileDeliveryRequired());

        updateOrderAmounts(booking.getOrder(), estimatedLogisticsCost);
        LogisticsBookingDetail savedBooking = bookingRepository.save(booking);

        LogisticsBookingDetailDto response = toDto(savedBooking);
        copyCalculationInputs(dto, response);
        response.setEstimatedLogisticsCost(estimatedLogisticsCost);
        return response;
    }

    public void delete(Long orderId) {
        bookingRepository.delete(findBooking(orderId));
    }

    private BigDecimal calculateEstimatedLogisticsCost(
            BigDecimal estimatedDistanceKm,
            int totalLocations,
            String bookingType,
            VehicleSummary vehicle,
            boolean specialHandlingRequired,
            boolean priorityDelivery,
            boolean lastMileDeliveryRequired) {

        if (estimatedDistanceKm == null
                || estimatedDistanceKm.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException(
                    "Estimated distance must be greater than zero");
        }

        // The configured rate is keyed by vehicle category (BIKE/AUTO/TRUCK sizes...). A booking that already
        // references a vehicle is priced by that vehicle's category. A customer's booking has no vehicle yet (the
        // fleet owner assigns one later) and carries the category the customer chose as its bookingType - that is
        // what the customer was quoted and paid for, so it is priced by that category. A bookingType that is not a
        // priced category (an "intercity"/"local" classification) has nothing to price a distance charge against
        // and adds no vehicle charge, exactly as before.
        BigDecimal baseVehicleCharge = BigDecimal.ZERO;
        var rate = vehicle != null
                ? java.util.Optional.of(logisticsRateService.get(vehicle.vehicleType()))
                : logisticsRateService.find(bookingType);
        if (rate.isPresent()) {
            BigDecimal billableDistance = estimatedDistanceKm.max(rate.get().minimumDistanceKm());
            BigDecimal distanceBasedCharge = billableDistance.multiply(rate.get().ratePerKm());
            baseVehicleCharge = distanceBasedCharge.max(rate.get().minimumRate());
        }
        int additionalStops = Math.max(totalLocations - 2, 0);
        BigDecimal additionalStopCharge = ADDITIONAL_STOP_RATE.multiply(
                BigDecimal.valueOf(additionalStops));
        BigDecimal handlingCharge = specialHandlingRequired
                ? HANDLING_CHARGE : BigDecimal.ZERO;
        BigDecimal lastMileCharge = lastMileDeliveryRequired
                ? LAST_MILE_CHARGE : BigDecimal.ZERO;

        BigDecimal subtotal = baseVehicleCharge
                .add(additionalStopCharge)
                .add(handlingCharge)
                .add(lastMileCharge);

        BigDecimal priorityCharge = priorityDelivery
                ? subtotal.multiply(PRIORITY_PERCENTAGE)
                : BigDecimal.ZERO;

        return subtotal.add(priorityCharge).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateVehicleCharge(VehicleSummary vehicle) {
        if (vehicle == null || vehicle.vehicleType() == null) {
            return BigDecimal.ZERO;
        }

        return switch (vehicle.vehicleType().trim().toUpperCase()) {
            case "BIKE" -> new BigDecimal("50.00");
            case "AUTO" -> new BigDecimal("100.00");
            case "MINI_TRUCK" -> new BigDecimal("250.00");
            case "TRUCK" -> new BigDecimal("500.00");
            case "HEAVY_TRUCK" -> new BigDecimal("1000.00");
            default -> throw new IllegalArgumentException(
                    "Unsupported vehicle type: " + vehicle.vehicleType());
        };
    }

    private int validateLocationsAndGetCount(String locationsJson) {
        if (locationsJson == null || locationsJson.isBlank()) {
            throw new IllegalArgumentException("Booking locations JSON is required");
        }

        try {
            JsonNode locations = objectMapper.readTree(locationsJson);
            if (!locations.isArray() || locations.size() < 2) {
                throw new IllegalArgumentException(
                        "At least one pickup and one drop location are required");
            }

            boolean pickupFound = false;
            boolean dropFound = false;

            for (JsonNode location : locations) {
                String type = location.path("type").asText().trim().toUpperCase();
                String address = location.path("address").asText().trim();

                if (address.isBlank()) {
                    throw new IllegalArgumentException(
                            "Address is required for every location");
                }
                if ("PICKUP".equals(type)) {
                    pickupFound = true;
                }
                if ("DROP".equals(type)) {
                    dropFound = true;
                }
            }

            if (!pickupFound || !dropFound) {
                throw new IllegalArgumentException(
                        "Booking locations must contain PICKUP and DROP");
            }
            return locations.size();
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalArgumentException(
                    "Booking locations must contain valid JSON", exception);
        }
    }

    private void validateDto(LogisticsBookingDetailDto dto) {
        if (dto == null) {
            throw new IllegalArgumentException("Request body is required");
        }
        if (dto.getOrderId() == null) {
            throw new IllegalArgumentException("Order ID is required");
        }
        if (dto.getReceiverName() == null || dto.getReceiverName().isBlank()) {
            throw new IllegalArgumentException("Receiver name is required");
        }
        if (dto.getBookingType() == null || dto.getBookingType().isBlank()) {
            throw new IllegalArgumentException("Booking type is required");
        }
    }

    private void validateOrder(Order order) {
        if (!"FLEET_SERVICE".equalsIgnoreCase(order.getOrderType())) {
            throw new IllegalArgumentException(
                    "Logistics booking is allowed only for FLEET_SERVICE orders");
        }
        if ("CANCELLED".equalsIgnoreCase(order.getOrderStatus())) {
            throw new IllegalArgumentException("A cancelled order cannot be booked");
        }
    }

    private void validateReceiver(LogisticsBookingDetailDto dto) {
        if (dto.getReceiverPhoneNumber() == null
                || !dto.getReceiverPhoneNumber().trim().matches("^[0-9]{10}$")) {
            throw new IllegalArgumentException(
                    "Receiver mobile number must be exactly 10 digits");
        }
    }

    private void updateOrderAmounts(Order order, BigDecimal logisticsCost) {
        BigDecimal subtotal = order.getSubtotalAmount() == null
                ? BigDecimal.ZERO : order.getSubtotalAmount();
        BigDecimal discount = order.getDiscountAmount() == null
                ? BigDecimal.ZERO : order.getDiscountAmount();

        order.setDeliveryCharge(logisticsCost);
        BigDecimal totalAmount = subtotal
                .add(logisticsCost)
                .subtract(discount)
                .max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);

        order.setTotalAmount(totalAmount);
        order.setOrderStatus("BOOKING_CONFIRMED");
    }

    private void copyDtoToEntity(
            LogisticsBookingDetailDto dto,
            LogisticsBookingDetail booking,
            Order order,
            VehicleSummary vehicle) {

        booking.setOrder(order);
        booking.setVehicleReferenceId(
                vehicle == null ? null : vehicle.vehicleId());
        /*
         * customer_profile lives in S3; the scalar FK is stored as supplied.
         */
        booking.setReceiverCustomerProfileId(dto.getReceiverCustomerProfileId());
        booking.setReceiverName(dto.getReceiverName().trim());
        booking.setReceiverPhoneNumber(dto.getReceiverPhoneNumber().trim());
        booking.setReceiverEmail(dto.getReceiverEmail());
        booking.setBookingType(dto.getBookingType().trim().toUpperCase());
        booking.setBookingLocationsJson(dto.getBookingLocationsJson());
        booking.setSpecialInstructions(dto.getSpecialInstructions());
    }

    private LogisticsBookingDetailDto toDto(LogisticsBookingDetail booking) {
        LogisticsBookingDetailDto dto = new LogisticsBookingDetailDto();
        dto.setOrderId(booking.getOrder().getId());

        dto.setVehicleReferenceId(booking.getVehicleReferenceId());
        dto.setReceiverCustomerProfileId(booking.getReceiverCustomerProfileId());

        dto.setReceiverName(booking.getReceiverName());
        dto.setReceiverPhoneNumber(booking.getReceiverPhoneNumber());
        dto.setReceiverEmail(booking.getReceiverEmail());
        dto.setBookingType(booking.getBookingType());
        dto.setBookingLocationsJson(booking.getBookingLocationsJson());
        dto.setSpecialInstructions(booking.getSpecialInstructions());
        return dto;
    }

    private void copyCalculationInputs(
            LogisticsBookingDetailDto source,
            LogisticsBookingDetailDto target) {
        target.setEstimatedDistanceKm(source.getEstimatedDistanceKm());
        target.setSpecialHandlingRequired(source.isSpecialHandlingRequired());
        target.setPriorityDelivery(source.isPriorityDelivery());
        target.setLastMileDeliveryRequired(source.isLastMileDeliveryRequired());
    }

    private LogisticsBookingDetail findBooking(Long orderId) {
        return bookingRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Logistics booking not found for order ID: " + orderId));
    }

    private Order findRequiredOrder(Long orderId) {
        if (orderId == null) {
            throw new ResourceNotFoundException("Order not found with ID: " + null);
        }
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Order not found with ID: " + orderId));
    }

    /*
     * The vehicle reference is optional. When supplied it is fetched from S5 because the
     * cost calculation reads the vehicle type; the actual "fetch by id, map a miss or a
     * Feign failure to 404" lookup is shared with TripService's own vehicle/driver/user
     * lookups via ExternalReferenceLookup - see its javadoc for why FeignException is
     * caught broadly.
     */
    private VehicleSummary fetchOptionalVehicle(UUID vehicleId) {
        if (vehicleId == null) {
            return null;
        }
        return ExternalReferenceLookup.require(vehicleId, "Vehicle", vehicleClient::getVehicle);
    }
}
