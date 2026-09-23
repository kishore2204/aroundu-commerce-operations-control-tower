package com.cbg.lbos.service;

import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.cbg.lbos.client.S2PartnerClient;
import com.cbg.lbos.client.S5FleetClient;

/**
 * Answers one question for the login flow: has this account's partner record been approved yet?
 *
 * <p>S1's own {@code user_account.account_status} is not that answer. Every partner account is
 * created ACTIVE (see DriverServiceImpl.create() in S5, and registerPublicUser() here) while the
 * approval state lives in the owning service - S5's {@code Driver.driverStatus} for drivers, and
 * S2's {@code Retailer.retailerStatus} / {@code FleetOwner.profileStatus} for retailers and fleet
 * owners. So a driver who has signed up but whose documents are still in the verification queue
 * previously reached the dashboard (or a generic failure) with nothing telling them what was
 * wrong. This gate is checked only after the password has already been verified, so the clearer
 * message it enables cannot be used to probe which emails exist.
 *
 * <p>Deliberately fails open. If the owning service is unreachable, or has no record for this
 * account (a fleet owner who registered but never completed the partner profile, seeded demo
 * accounts, staff roles), login proceeds as before - a downstream outage must not lock everyone
 * out of the platform.
 */
@Service
public class SubjectVerificationGate {

    private static final Logger log = LoggerFactory.getLogger(SubjectVerificationGate.class);

    /** Shown for every subject type, so the wording does not itself reveal the account's role. */
    public static final String PENDING_VERIFICATION_MESSAGE =
            "Your account is pending verification. You'll be able to log in once approved.";

    /** S5 DriverStatus values that mean "not approved yet". A driver is created INACTIVE and
     *  sits at PENDING while queued; SUSPENDED and LICENSE_EXPIRED are different problems and
     *  are left to the existing account-status handling rather than mislabelled as pending. */
    private static final Set<String> PENDING_DRIVER_STATUSES = Set.of("PENDING", "INACTIVE");

    /** S2 statuses that mean "not approved yet" for a retailer or a fleet owner's profile. */
    private static final Set<String> PENDING_PARTNER_STATUSES =
            Set.of("PENDING_VERIFICATION", "PENDING", "UNVERIFIED", "SUBMITTED", "IN_REVIEW");

    private final S5FleetClient fleetClient;
    private final S2PartnerClient partnerClient;

    /**
     * Creates the gate.
     *
     * @param fleetClient S5 client used to read a driver's approval status
     * @param partnerClient S2 client used to read a retailer's or fleet owner's approval status
     */
    public SubjectVerificationGate(S5FleetClient fleetClient, S2PartnerClient partnerClient) {
        this.fleetClient = fleetClient;
        this.partnerClient = partnerClient;
    }

    /**
     * Whether this account's partner record is still awaiting approval.
     *
     * @param userAccountId the authenticated account's id
     * @param role the account's role - only DRIVER, RETAILER and FLEET_MANAGER have a partner
     *        record to check; every other role returns false
     * @return true if the subject exists and has not been approved yet
     */
    public boolean isAwaitingVerification(UUID userAccountId, String role) {
        if (userAccountId == null || role == null) {
            return false;
        }
        return switch (role.trim().toUpperCase()) {
            case "DRIVER" -> isDriverAwaitingVerification(userAccountId);
            case "RETAILER" -> isRetailerAwaitingVerification(userAccountId);
            case "FLEET_MANAGER" -> isFleetOwnerAwaitingVerification(userAccountId);
            default -> false;
        };
    }

    private boolean isDriverAwaitingVerification(UUID userAccountId) {
        try {
            S5FleetClient.DriverStatusResponse driver = fleetClient.getDriverByUserAccountId(userAccountId);
            return driver != null && driver.driverStatus() != null
                    && PENDING_DRIVER_STATUSES.contains(driver.driverStatus().trim().toUpperCase());
        } catch (RuntimeException lookupFailed) {
            return failOpen("driver", userAccountId, lookupFailed);
        }
    }

    private boolean isRetailerAwaitingVerification(UUID userAccountId) {
        try {
            S2PartnerClient.RetailerContextResponse retailer = partnerClient.getRetailerByUserAccountId(userAccountId);
            return retailer != null && isPendingPartnerStatus(retailer.retailerStatus());
        } catch (RuntimeException lookupFailed) {
            return failOpen("retailer", userAccountId, lookupFailed);
        }
    }

    private boolean isFleetOwnerAwaitingVerification(UUID userAccountId) {
        try {
            S2PartnerClient.FleetOwnerValidationResponse owner =
                    partnerClient.getFleetOwnerByUserAccountId(userAccountId);
            return owner != null && isPendingPartnerStatus(owner.profileStatus());
        } catch (RuntimeException lookupFailed) {
            return failOpen("fleet owner", userAccountId, lookupFailed);
        }
    }

    private boolean isPendingPartnerStatus(String status) {
        return status != null && PENDING_PARTNER_STATUSES.contains(status.trim().toUpperCase());
    }

    private boolean failOpen(String subjectType, UUID userAccountId, RuntimeException cause) {
        log.debug("Could not read {} verification status for account {} - allowing login: {}",
                subjectType, userAccountId, cause.toString());
        return false;
    }
}
