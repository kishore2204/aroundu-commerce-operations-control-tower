package com.cbg.lbos.controller;

import com.cbg.lbos.dto.TripDto;
import com.cbg.lbos.dto.TripProofRequest;
import com.cbg.lbos.dto.TripStatusHistoryDto;
import com.cbg.lbos.service.TripService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/trips")
public class TripController {

    private final TripService tripService;

    public TripController(TripService tripService) {
        this.tripService = tripService;
    }

    @PostMapping
    public ResponseEntity<TripDto> create(@Valid @RequestBody TripDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(tripService.create(dto));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TripDto> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(tripService.getById(id));
    }

    /** Timestamped audit trail of every status transition this trip has gone through. */
    @GetMapping("/{id}/history")
    public ResponseEntity<List<TripStatusHistoryDto>> history(@PathVariable UUID id) {
        return ResponseEntity.ok(tripService.getStatusHistory(id));
    }

    @GetMapping
    public ResponseEntity<List<TripDto>> getAll() {
        return ResponseEntity.ok(tripService.getAll());
    }

    /** Fleet-owner-facing: this fleet owner's own trips. */
    @GetMapping("/mine")
    public ResponseEntity<List<TripDto>> mine(
            @RequestParam(required = false) UUID fleetOwnerId,
            org.springframework.security.core.Authentication authentication) {
        UUID targetId = fleetOwnerId;
        if (targetId == null && authentication != null && authentication.getName() != null) {
            try {
                targetId = UUID.fromString(authentication.getName());
            } catch (Exception ignored) {
            }
        }
        if (targetId == null) {
            return ResponseEntity.ok(List.of());
        }
        return ResponseEntity.ok(tripService.getMineForFleetOwner(targetId));
    }

    /** Driver-facing: active trips for the authenticated driver. */
    @GetMapping("/driver/mine")
    public ResponseEntity<List<TripDto>> driverMine(org.springframework.security.core.Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.ok(List.of());
        }
        try {
            UUID userAccountId = UUID.fromString(authentication.getName());
            return ResponseEntity.ok(tripService.getActiveForDriverUserAccount(userAccountId));
        } catch (Exception e) {
            return ResponseEntity.ok(List.of());
        }
    }


    @PutMapping("/{id}")
    public ResponseEntity<TripDto> update(
            @PathVariable UUID id,
            @Valid @RequestBody TripDto dto) {
        return ResponseEntity.ok(tripService.update(id, dto));
    }

    /*
     * DRIVER-APP LIFECYCLE ACTIONS
     *
     * These are thin convenience wrappers over the same TripService logic the
     * generic PUT already uses - no state-machine rule is duplicated here.
     */

    /**
     * Acknowledgement only: Trip has no ARRIVED status, so this confirms the
     * trip exists and is ASSIGNED and echoes back its unchanged state.
     */
    @PostMapping("/{id}/pickup/arrived")
    public ResponseEntity<TripDto> pickupArrived(@PathVariable UUID id) {
        return ResponseEntity.ok(tripService.acknowledgePickupArrival(id));
    }

    @PostMapping("/{id}/pickup/confirm")
    public ResponseEntity<TripDto> confirmPickup(
            @PathVariable UUID id,
            @RequestBody(required = false) TripProofRequest request) {

        return ResponseEntity.ok(
                tripService.confirmPickup(id, proofOf(request)));
    }

    /**
     * Acknowledgement only, for the same reason as {@link #pickupArrived}.
     */
    @PostMapping("/{id}/delivery/arrived")
    public ResponseEntity<TripDto> deliveryArrived(@PathVariable UUID id) {
        return ResponseEntity.ok(tripService.acknowledgeDeliveryArrival(id));
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<TripDto> complete(
            @PathVariable UUID id,
            @RequestBody(required = false) TripProofRequest request) {

        return ResponseEntity.ok(
                tripService.completeDelivery(id, proofOf(request)));
    }

    private String proofOf(TripProofRequest request) {
        return request == null ? null : request.proof();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        tripService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
