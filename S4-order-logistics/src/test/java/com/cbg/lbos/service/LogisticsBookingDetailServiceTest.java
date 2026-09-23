package com.cbg.lbos.service;

import com.cbg.lbos.client.VehicleClient;
import com.cbg.lbos.client.dto.VehicleSummary;
import com.cbg.lbos.dto.LogisticsBookingDetailDto;
import com.cbg.lbos.entity.LogisticsBookingDetail;
import com.cbg.lbos.entity.Order;
import com.cbg.lbos.exception.ResourceNotFoundException;
import com.cbg.lbos.repository.LogisticsBookingDetailRepository;
import com.cbg.lbos.repository.OrderRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import feign.FeignException;
import feign.Request;
import feign.RequestTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import com.cbg.lbos.dto.LogisticsQuoteRequest;
import com.cbg.lbos.dto.LogisticsQuoteResponse;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LogisticsBookingDetailServiceTest {

    private static final Long ORDER_ID = 42L;
    private static final UUID VEHICLE_ID = UUID.randomUUID();
    private static final UUID RECEIVER_PROFILE_ID = UUID.randomUUID();

    private static final String TWO_LOCATIONS = """
            [{"type":"PICKUP","address":"12 MG Road, Bengaluru"},
             {"type":"DROP","address":"88 Park Street, Kolkata"}]""";

    private static final String THREE_LOCATIONS = """
            [{"type":"PICKUP","address":"12 MG Road, Bengaluru"},
             {"type":"DROP","address":"5 Anna Salai, Chennai"},
             {"type":"DROP","address":"88 Park Street, Kolkata"}]""";

    @Mock
    private LogisticsBookingDetailRepository bookingRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private VehicleClient vehicleClient;

    // Not a @Mock: a pure, dependency-free in-memory rate registry - a real instance gives
    // these tests the same default tariffs production actually starts with.
    private final LogisticsRateService logisticsRateService = new LogisticsRateService();

    private LogisticsBookingDetailService service;

    @BeforeEach
    void setUp() {
        service = new LogisticsBookingDetailService(
                bookingRepository,
                orderRepository,
                vehicleClient,
                new ObjectMapper(),
                logisticsRateService);
    }

    private Order fleetOrder() {
        Order order = new Order();
        order.setId(ORDER_ID);
        order.setOrderType("FLEET_SERVICE");
        order.setOrderStatus("NEW");
        order.setSubtotalAmount(new BigDecimal("1000.00"));
        order.setDiscountAmount(new BigDecimal("100.00"));
        return order;
    }

    private VehicleSummary vehicle(String vehicleType) {
        return new VehicleSummary(
                VEHICLE_ID,
                UUID.randomUUID(),
                UUID.randomUUID(),
                "KA01AB1234",
                vehicleType,
                "Tata",
                "Ace",
                2022,
                new BigDecimal("1000.00"),
                "ACTIVE");
    }

    private LogisticsBookingDetailDto validDto() {
        LogisticsBookingDetailDto dto = new LogisticsBookingDetailDto();
        dto.setOrderId(ORDER_ID);
        dto.setVehicleReferenceId(VEHICLE_ID);
        dto.setReceiverCustomerProfileId(RECEIVER_PROFILE_ID);
        dto.setReceiverName("Ravi Kumar");
        dto.setReceiverPhoneNumber("9876543210");
        dto.setReceiverEmail("ravi@example.com");
        dto.setBookingType("intercity");
        dto.setBookingLocationsJson(TWO_LOCATIONS);
        dto.setEstimatedDistanceKm(new BigDecimal("10"));
        return dto;
    }

    private void stubCreateFlow(String vehicleType) {
        lenient().when(bookingRepository.existsById(ORDER_ID)).thenReturn(false);
        lenient().when(orderRepository.findById(ORDER_ID))
                .thenReturn(Optional.of(fleetOrder()));
        lenient().when(vehicleClient.getVehicle(VEHICLE_ID))
                .thenReturn(vehicle(vehicleType));
        lenient().when(bookingRepository.save(any(LogisticsBookingDetail.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    private FeignException serverError() {
        Request request = Request.create(
                Request.HttpMethod.GET,
                "/api/vehicles/" + VEHICLE_ID,
                new HashMap<>(),
                null,
                StandardCharsets.UTF_8,
                new RequestTemplate());
        return FeignException.errorStatus(
                "VehicleClient#getVehicle(UUID)",
                feign.Response.builder()
                        .status(500)
                        .reason("Internal Server Error")
                        .request(request)
                        .headers(new HashMap<>())
                        .build());
    }

    @Test
    void createComputesBaseDistanceAndVehicleCharges() {
        stubCreateFlow("TRUCK");

        LogisticsBookingDetailDto result = service.create(validDto());

        // TRUCK normalizes to FOUR_WHEEL_TRUCK (LogisticsRateService default: 28/km, min 5km,
        // min rate 250) - billable 10km * 28 = 280, above the 250 floor.
        assertEquals(new BigDecimal("280.00"), result.getEstimatedLogisticsCost());
    }

    @Test
    void createAppliesTheTwentyPercentPriorityUplift() {
        stubCreateFlow("TRUCK");

        LogisticsBookingDetailDto dto = validDto();
        dto.setPriorityDelivery(true);

        // 280 + 20% = 336.00
        assertEquals(new BigDecimal("336.00"),
                service.create(dto).getEstimatedLogisticsCost());
    }

    @Test
    void createChargesForAdditionalStopsHandlingAndLastMile() {
        stubCreateFlow("BIKE");

        LogisticsBookingDetailDto dto = validDto();
        dto.setBookingLocationsJson(THREE_LOCATIONS);
        dto.setSpecialHandlingRequired(true);
        dto.setLastMileDeliveryRequired(true);

        // BIKE (10/km, min 2km, min rate 50): 10km * 10 = 100, above the 50 floor.
        // + one extra stop 50 + handling 100 + last mile 150
        assertEquals(new BigDecimal("400.00"),
                service.create(dto).getEstimatedLogisticsCost());
    }

    @Test
    void createWithoutAVehicleReferenceSkipsTheVehicleChargeAndTheFleetCall() {
        lenient().when(bookingRepository.existsById(ORDER_ID)).thenReturn(false);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(fleetOrder()));
        when(bookingRepository.save(any(LogisticsBookingDetail.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        LogisticsBookingDetailDto dto = validDto();
        dto.setVehicleReferenceId(null);

        LogisticsBookingDetailDto result = service.create(dto);

        // "intercity" is a classification, not a priced vehicle category: with no vehicle there is nothing to
        // price a distance charge against, so no vehicle charge is added (see calculateEstimatedLogisticsCost).
        assertEquals(new BigDecimal("0.00"), result.getEstimatedLogisticsCost());
        assertNull(result.getVehicleReferenceId());
        verify(vehicleClient, never()).getVehicle(any(UUID.class));
    }

    /** A customer books without a vehicle (the fleet owner assigns one later) and the category they chose is the bookingType. */
    private Order customerFleetOrder() {
        Order order = new Order();
        order.setId(ORDER_ID);
        order.setOrderType("FLEET_SERVICE");
        order.setOrderStatus("NEW");
        order.setSubtotalAmount(BigDecimal.ZERO);
        order.setDiscountAmount(BigDecimal.ZERO);
        order.setTotalAmount(BigDecimal.ZERO);
        return order;
    }

    private LogisticsBookingDetailDto customerBooking(String category, String distanceKm) {
        LogisticsBookingDetailDto dto = validDto();
        dto.setVehicleReferenceId(null);
        dto.setBookingType(category);
        dto.setEstimatedDistanceKm(new BigDecimal(distanceKm));
        return dto;
    }

    @Test
    void aCustomerBookingWithoutAVehicleIsPricedByTheCategoryTheCustomerChoseAndTheOrderStoresThatAmount() {
        Order order = customerFleetOrder();
        lenient().when(bookingRepository.existsById(ORDER_ID)).thenReturn(false);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
        when(bookingRepository.save(any(LogisticsBookingDetail.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        LogisticsBookingDetailDto result = service.create(customerBooking("BIKE", "10"));

        // BIKE: 10 per km, minimum 50 -> 10 km = 100.00 - the very number the payment screen was quoted
        assertEquals(new BigDecimal("100.00"), result.getEstimatedLogisticsCost());
        assertEquals(new BigDecimal("100.00"), order.getDeliveryCharge());
        assertEquals(new BigDecimal("100.00"), order.getTotalAmount(), "the order total is what the payment is created for");
        verify(vehicleClient, never()).getVehicle(any(UUID.class));
    }

    @Test
    void theMinimumRateAndTheExtrasAreAppliedToACategoryPricedBooking() {
        // 1 km on a BIKE -> minimum distance 2 km = 20.00 -> minimum rate 50.00
        assertEquals(new BigDecimal("50.00"), service.quote(new LogisticsQuoteRequest("BIKE", new BigDecimal("1"), false, false, false)).totalAmount());
        // (100.00 + handling 100 + last mile 150) * 1.20 priority = 420.00
        assertEquals(new BigDecimal("420.00"), service.quote(new LogisticsQuoteRequest("BIKE", new BigDecimal("10"), true, true, true)).totalAmount());
    }

    @Test
    void theQuoteIsExactlyWhatCreatingTheBookingStoresOnTheOrder() {
        LogisticsBookingDetailDto booking = customerBooking("SMALL_TRUCK", "25.5");
        booking.setSpecialHandlingRequired(true);
        booking.setPriorityDelivery(true);
        Order order = customerFleetOrder();
        lenient().when(bookingRepository.existsById(ORDER_ID)).thenReturn(false);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
        when(bookingRepository.save(any(LogisticsBookingDetail.class))).thenAnswer(invocation -> invocation.getArgument(0));

        LogisticsQuoteResponse quote = service.quote(new LogisticsQuoteRequest("SMALL_TRUCK", new BigDecimal("25.5"), true, true, false));
        LogisticsBookingDetailDto created = service.create(booking);

        assertEquals(created.getEstimatedLogisticsCost(), order.getDeliveryCharge());
        assertEquals(order.getTotalAmount(), quote.totalAmount());
    }

    @Test
    void extrasLeftOutOfAQuoteRequestMeanNo() {
        assertEquals(new BigDecimal("100.00"), service.quote(new LogisticsQuoteRequest("BIKE", new BigDecimal("10"), null, null, null)).totalAmount());
    }

    @Test
    void aQuoteForAnUnpricedBookingTypeOrAMissingTypeOrDistanceIsHandledLikeCreate() {
        assertEquals(new BigDecimal("0.00"), service.quote(new LogisticsQuoteRequest("intercity", new BigDecimal("10"), false, false, false)).totalAmount());
        assertThrows(IllegalArgumentException.class, () -> service.quote(new LogisticsQuoteRequest("  ", new BigDecimal("10"), false, false, false)));
        assertThrows(IllegalArgumentException.class, () -> service.quote(new LogisticsQuoteRequest("BIKE", BigDecimal.ZERO, false, false, false)));
    }

    @Test
    void createPushesTheCostOntoTheOrderTotalAndConfirmsTheBooking() {
        Order order = fleetOrder();
        lenient().when(bookingRepository.existsById(ORDER_ID)).thenReturn(false);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
        when(vehicleClient.getVehicle(VEHICLE_ID)).thenReturn(vehicle("TRUCK"));
        when(bookingRepository.save(any(LogisticsBookingDetail.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.create(validDto());

        assertEquals(new BigDecimal("280.00"), order.getDeliveryCharge());
        // 1000 subtotal + 280 delivery - 100 discount
        assertEquals(new BigDecimal("1180.00"), order.getTotalAmount());
        assertEquals("BOOKING_CONFIRMED", order.getOrderStatus());
    }

    @Test
    void createStoresTheReceiverProfileIdAsAnUnvalidatedScalar() {
        stubCreateFlow("AUTO");

        LogisticsBookingDetailDto result = service.create(validDto());

        assertEquals(RECEIVER_PROFILE_ID, result.getReceiverCustomerProfileId());
        assertEquals(VEHICLE_ID, result.getVehicleReferenceId());
        assertEquals("INTERCITY", result.getBookingType());
    }

    @Test
    void createRejectsADuplicateBooking() {
        when(bookingRepository.existsById(ORDER_ID)).thenReturn(true);

        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> service.create(validDto()));

        assertEquals("Logistics booking already exists for order ID: 42",
                exception.getMessage());
    }

    @Test
    void createThrowsWhenTheOrderIsMissing() {
        when(bookingRepository.existsById(ORDER_ID)).thenReturn(false);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> service.create(validDto()));
    }

    @Test
    void createRejectsANonFleetServiceOrder() {
        Order retailOrder = fleetOrder();
        retailOrder.setOrderType("RETAIL");
        when(bookingRepository.existsById(ORDER_ID)).thenReturn(false);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(retailOrder));

        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> service.create(validDto()));

        assertEquals("Logistics booking is allowed only for FLEET_SERVICE orders",
                exception.getMessage());
    }

    @Test
    void createRejectsACancelledOrder() {
        Order cancelled = fleetOrder();
        cancelled.setOrderStatus("CANCELLED");
        when(bookingRepository.existsById(ORDER_ID)).thenReturn(false);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(cancelled));

        assertThrows(IllegalArgumentException.class, () -> service.create(validDto()));
    }

    @Test
    void createRejectsAnInvalidReceiverPhoneNumber() {
        when(bookingRepository.existsById(ORDER_ID)).thenReturn(false);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(fleetOrder()));

        LogisticsBookingDetailDto dto = validDto();
        dto.setReceiverPhoneNumber("12345");

        assertThrows(IllegalArgumentException.class, () -> service.create(dto));
    }

    @Test
    void createRequiresABlankFreeReceiverName() {
        LogisticsBookingDetailDto dto = validDto();
        dto.setReceiverName("  ");

        assertThrows(IllegalArgumentException.class, () -> service.create(dto));
    }

    @Test
    void createRequiresAtLeastAPickupAndADropLocation() {
        when(bookingRepository.existsById(ORDER_ID)).thenReturn(false);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(fleetOrder()));

        LogisticsBookingDetailDto dto = validDto();
        dto.setBookingLocationsJson(
                "[{\"type\":\"PICKUP\",\"address\":\"12 MG Road\"}]");

        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> service.create(dto));

        assertEquals("At least one pickup and one drop location are required",
                exception.getMessage());
    }

    @Test
    void createRejectsLocationsThatAreMissingADropStop() {
        when(bookingRepository.existsById(ORDER_ID)).thenReturn(false);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(fleetOrder()));

        LogisticsBookingDetailDto dto = validDto();
        dto.setBookingLocationsJson(
                "[{\"type\":\"PICKUP\",\"address\":\"A road\"},"
                        + "{\"type\":\"PICKUP\",\"address\":\"B road\"}]");

        assertEquals("Booking locations must contain PICKUP and DROP",
                assertThrows(IllegalArgumentException.class,
                        () -> service.create(dto)).getMessage());
    }

    @Test
    void createRejectsMalformedLocationsJson() {
        when(bookingRepository.existsById(ORDER_ID)).thenReturn(false);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(fleetOrder()));

        LogisticsBookingDetailDto dto = validDto();
        dto.setBookingLocationsJson("{not json");

        assertThrows(IllegalArgumentException.class, () -> service.create(dto));
    }

    @Test
    void createRejectsANonPositiveEstimatedDistance() {
        stubCreateFlow("TRUCK");

        LogisticsBookingDetailDto dto = validDto();
        dto.setEstimatedDistanceKm(BigDecimal.ZERO);

        assertEquals("Estimated distance must be greater than zero",
                assertThrows(IllegalArgumentException.class,
                        () -> service.create(dto)).getMessage());
    }

    @Test
    void createRejectsAnUnsupportedVehicleType() {
        stubCreateFlow("SPACESHIP");

        assertEquals("Unsupported vehicle category: SPACESHIP",
                assertThrows(IllegalArgumentException.class,
                        () -> service.create(validDto())).getMessage());
    }

    @Test
    void createTranslatesAFleetServiceFailureIntoResourceNotFound() {
        when(bookingRepository.existsById(ORDER_ID)).thenReturn(false);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(fleetOrder()));
        when(vehicleClient.getVehicle(VEHICLE_ID)).thenThrow(serverError());

        ResourceNotFoundException exception = assertThrows(
                ResourceNotFoundException.class,
                () -> service.create(validDto()));

        assertEquals("Vehicle not found with ID: " + VEHICLE_ID, exception.getMessage());
    }

    @Test
    void updateRejectsAnOrderIdMismatchBetweenUrlAndBody() {
        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> service.update(99L, validDto()));

        assertEquals("Order ID in URL and request body must be the same",
                exception.getMessage());
    }

    @Test
    void updateRecalculatesTheCostAndTheOrderTotal() {
        Order order = fleetOrder();
        LogisticsBookingDetail booking = new LogisticsBookingDetail();
        booking.setOrder(order);

        when(bookingRepository.findById(ORDER_ID)).thenReturn(Optional.of(booking));
        when(vehicleClient.getVehicle(VEHICLE_ID)).thenReturn(vehicle("MINI_TRUCK"));
        when(bookingRepository.save(any(LogisticsBookingDetail.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        LogisticsBookingDetailDto result = service.update(ORDER_ID, validDto());

        // MINI_TRUCK normalizes to SMALL_TRUCK (20/km, min 5km, min rate 150): 10km * 20 = 200.
        assertEquals(new BigDecimal("200.00"), result.getEstimatedLogisticsCost());
        assertEquals(new BigDecimal("200.00"), order.getDeliveryCharge());
        // 1000 subtotal + 200 delivery - 100 discount
        assertEquals(new BigDecimal("1100.00"), order.getTotalAmount());
    }

    @Test
    void updateThrowsWhenTheBookingIsMissing() {
        when(bookingRepository.findById(ORDER_ID)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> service.update(ORDER_ID, validDto()));
    }

    @Test
    void getByIdReportsTheStoredDeliveryChargeAsTheEstimatedCost() {
        Order order = fleetOrder();
        order.setDeliveryCharge(new BigDecimal("777.00"));
        LogisticsBookingDetail booking = new LogisticsBookingDetail();
        booking.setOrder(order);
        booking.setVehicleReferenceId(VEHICLE_ID);
        booking.setReceiverCustomerProfileId(RECEIVER_PROFILE_ID);
        when(bookingRepository.findById(ORDER_ID)).thenReturn(Optional.of(booking));

        LogisticsBookingDetailDto result = service.getById(ORDER_ID);

        assertEquals(new BigDecimal("777.00"), result.getEstimatedLogisticsCost());
        assertEquals(VEHICLE_ID, result.getVehicleReferenceId());
    }

    @Test
    void getByIdThrowsWhenTheBookingIsMissing() {
        when(bookingRepository.findById(ORDER_ID)).thenReturn(Optional.empty());

        assertEquals("Logistics booking not found for order ID: 42",
                assertThrows(ResourceNotFoundException.class,
                        () -> service.getById(ORDER_ID)).getMessage());
    }

    @Test
    void deleteRemovesAnExistingBooking() {
        LogisticsBookingDetail booking = new LogisticsBookingDetail();
        booking.setOrder(fleetOrder());
        when(bookingRepository.findById(ORDER_ID)).thenReturn(Optional.of(booking));

        service.delete(ORDER_ID);

        verify(bookingRepository).delete(booking);
    }
}
