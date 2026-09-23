package com.cbg.lbos.controller;

import com.cbg.lbos.dto.TripDto;
import com.cbg.lbos.dto.TripProofRequest;
import com.cbg.lbos.service.TripService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The driver-app lifecycle endpoints are deliberately thin: these tests pin
 * down that each one delegates to the matching TripService method and that an
 * omitted request body is passed through as a null proof.
 */
@ExtendWith(MockitoExtension.class)
class TripControllerTest {

    private static final UUID TRIP_ID = UUID.randomUUID();

    @Mock
    private TripService tripService;

    @InjectMocks
    private TripController tripController;

    private TripDto tripDto(String status) {
        TripDto dto = new TripDto();
        dto.setId(TRIP_ID);
        dto.setTripStatus(status);
        return dto;
    }

    @Test
    void pickupArrivedDelegatesToTheAcknowledgementMethod() {
        TripDto acknowledged = tripDto("ASSIGNED");
        when(tripService.acknowledgePickupArrival(TRIP_ID)).thenReturn(acknowledged);

        ResponseEntity<TripDto> response = tripController.pickupArrived(TRIP_ID);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertSame(acknowledged, response.getBody());
    }

    @Test
    void deliveryArrivedDelegatesToTheAcknowledgementMethod() {
        TripDto acknowledged = tripDto("IN_PROGRESS");
        when(tripService.acknowledgeDeliveryArrival(TRIP_ID)).thenReturn(acknowledged);

        assertSame(acknowledged,
                tripController.deliveryArrived(TRIP_ID).getBody());
    }

    @Test
    void confirmPickupForwardsTheSuppliedProofOfPickup() {
        TripDto started = tripDto("IN_PROGRESS");
        when(tripService.confirmPickup(TRIP_ID, "pickup-photo.jpg")).thenReturn(started);

        ResponseEntity<TripDto> response = tripController.confirmPickup(
                TRIP_ID, new TripProofRequest("pickup-photo.jpg"));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertSame(started, response.getBody());
    }

    @Test
    void confirmPickupForwardsANullProofWhenTheBodyIsOmitted() {
        when(tripService.confirmPickup(TRIP_ID, null)).thenReturn(tripDto("ASSIGNED"));

        tripController.confirmPickup(TRIP_ID, null);

        verify(tripService).confirmPickup(TRIP_ID, null);
    }

    @Test
    void completeForwardsTheSuppliedProofOfDelivery() {
        TripDto completed = tripDto("COMPLETED");
        when(tripService.completeDelivery(TRIP_ID, "signed-pod.pdf")).thenReturn(completed);

        assertSame(completed,
                tripController.complete(TRIP_ID,
                        new TripProofRequest("signed-pod.pdf")).getBody());
    }

    @Test
    void completeForwardsANullProofWhenTheBodyIsOmitted() {
        when(tripService.completeDelivery(TRIP_ID, null)).thenReturn(tripDto("COMPLETED"));

        tripController.complete(TRIP_ID, null);

        verify(tripService).completeDelivery(TRIP_ID, null);
    }
}
