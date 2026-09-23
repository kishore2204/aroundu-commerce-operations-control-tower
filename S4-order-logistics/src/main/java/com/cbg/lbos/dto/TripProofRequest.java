package com.cbg.lbos.dto;

/**
 * Optional body for the driver-app trip lifecycle actions.
 *
 * <p>Carries only the proof value the action supplies (proof of pickup for
 * pickup confirmation, proof of delivery for completion). When the body is
 * omitted the proof already stored on the trip is reused, and the existing
 * {@code TripService.update(...)} validation decides whether that is enough.
 */
public record TripProofRequest(String proof) {
}
