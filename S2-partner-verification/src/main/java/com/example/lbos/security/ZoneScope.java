package com.example.lbos.security;

import com.example.lbos.client.LocationManagerClient;
import com.example.lbos.client.LocationManagerClient.LocationManagerSummary;
import com.example.lbos.dto.VerificationQueueDTO;
import com.example.lbos.exception.ForbiddenActionException;
import com.example.lbos.service.VerificationWork;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Keeps a LOCATION_MANAGER inside their own zone. Every other role is untouched: {@link #isLocationManager()}
 * is false for them, so existing behaviour (and the callers' authorisation rules) stay exactly as they were.
 *
 * <p>The zone is never taken from the request - it is read from S1 for the authenticated account on every call
 * (no caching, so a transfer takes effect immediately) and the check fails closed if S1 cannot be reached.
 */
@Component
public class ZoneScope {

    private final LocationManagerClient locationManagerClient;

    public ZoneScope(LocationManagerClient locationManagerClient) {
        this.locationManagerClient = locationManagerClient;
    }

    public static boolean isLocationManager() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_LOCATION_MANAGER".equals(authority.getAuthority()));
    }

    public static UUID callerAccountId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            return null;
        }
        try {
            return UUID.fromString(authentication.getName());
        } catch (IllegalArgumentException notAnAccountId) {
            return null;
        }
    }

    /** The caller's ACTIVE Location Manager assignment (zone, city, ...). */
    public LocationManagerSummary assignment() {
        UUID account = callerAccountId();
        LocationManagerSummary summary;
        try {
            summary = account == null ? null : locationManagerClient.getByUser(account);
        } catch (Exception lookupFailure) {
            throw new ForbiddenActionException("Your zone assignment could not be confirmed. Please try again.");
        }
        if (summary == null || !summary.isActive() || summary.zoneId() == null) {
            throw new ForbiddenActionException("You do not have an active Location Manager assignment");
        }
        return summary;
    }

    public UUID zoneId() {
        return assignment().zoneId();
    }

    /**
     * A verification request the caller may see and act on: one assigned to them, or one in their zone that has
     * not been handed to another officer (a request already decided stays visible to its zone as history).
     */
    public static boolean canSee(VerificationQueueDTO queue, UUID accountId, UUID zoneId) {
        if (accountId != null && accountId.equals(queue.getReviewedByAccountId())) {
            return true;
        }
        if (zoneId == null || !zoneId.equals(queue.getZoneId())) {
            return false;
        }
        boolean pending = Boolean.TRUE.equals(queue.getIsActive()) && queue.getVerificationStatus() != null
                && VerificationWork.PENDING_STATUSES.contains(queue.getVerificationStatus().toUpperCase());
        return queue.getReviewedByAccountId() == null || !pending;
    }

    public void requireVisible(VerificationQueueDTO queue) {
        if (!canSee(queue, callerAccountId(), assignment().zoneId())) {
            throw new ForbiddenActionException("This verification request is outside your zone");
        }
    }

    /** For retailer / fleet-owner records: they must be registered in the caller's zone. */
    public void requireZone(UUID recordZoneId) {
        if (recordZoneId == null || !recordZoneId.equals(assignment().zoneId())) {
            throw new ForbiddenActionException("This record is outside your zone");
        }
    }
}
