package com.cbg.lbos.service.support;

import com.cbg.lbos.exception.ResourceNotFoundException;
import feign.FeignException;
import java.util.UUID;
import java.util.function.Function;

/**
 * Shared "fetch a cross-service reference by id, translate a miss into a 404" pattern used
 * by both TripService (vehicle, driver, user-account lookups against S5/S1) and
 * LogisticsBookingDetailService (vehicle lookup against S5) - previously duplicated once per
 * lookup in each class. Neither S1 nor S5 has a global exception handler, so a missing record
 * surfaces as a generic 500 rather than a 404; FeignException is therefore caught broadly and
 * mapped to the same ResourceNotFoundException every local "not found" case already raises.
 */
public final class ExternalReferenceLookup {

    private ExternalReferenceLookup() {
    }

    public static <T> T require(UUID id, String label, Function<UUID, T> fetcher) {
        if (id == null) {
            throw new ResourceNotFoundException(label + " not found with ID: " + null);
        }

        T result;
        try {
            result = fetcher.apply(id);
        } catch (FeignException exception) {
            throw new ResourceNotFoundException(label + " not found with ID: " + id);
        }

        if (result == null) {
            throw new ResourceNotFoundException(label + " not found with ID: " + id);
        }
        return result;
    }
}
