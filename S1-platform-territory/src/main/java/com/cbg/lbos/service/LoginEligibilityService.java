package com.cbg.lbos.service;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.cbg.lbos.client.S2PartnerClient;
import com.cbg.lbos.client.S5FleetClient;
import com.cbg.lbos.entity.AssignmentStatus;
import com.cbg.lbos.entity.UserAccount;
import com.cbg.lbos.exception.InvalidCredentialsException;
import com.cbg.lbos.repository.LocationManagerRepository;
import com.cbg.lbos.repository.OperationsManagerRepository;
import com.cbg.lbos.repository.UserAccountRepository;

/**
 * Decides whether an account may sign in to the portal (and keep using it), by walking the role
 * hierarchy it belongs to:
 *
 * <pre>
 *   SUPER_ADMIN
 *     OPERATIONS_MANAGER        account ACTIVE + operations-manager assignment ACTIVE
 *       LOCATION_MANAGER        account ACTIVE + location-manager assignment ACTIVE
 *                               + supervising Operations Manager's assignment AND account ACTIVE
 *     FLEET_MANAGER (fleet owner)
 *       DRIVER                  account ACTIVE + driver not INACTIVE + owning fleet owner's account ACTIVE
 * </pre>
 *
 * Used by {@code AuthController.login} BEFORE a JWT is generated, and (through the internal
 * eligibility endpoint) by the API Gateway to reject an already-issued JWT once its account or
 * one of its parents has been made inactive.
 *
 * <p>Only S1-local data (accounts, operations-manager and location-manager assignments) is
 * authoritative. The driver's parent lookup crosses into S5/S2 and deliberately fails open - a
 * downstream outage must not lock every driver out, the same posture as
 * {@link SubjectVerificationGate}. S2's retailer/fleet-owner statuses are intentionally NOT
 * consulted: for partners they mean "not verified yet" and those users must still be able to log in
 * to finish onboarding.
 */
@Service
public class LoginEligibilityService {

    private static final Logger log = LoggerFactory.getLogger(LoginEligibilityService.class);

    /** Result of an eligibility check; {@code reason} is null when eligible. */
    public record Eligibility(boolean eligible, String reason) {
        static Eligibility ok() {
            return new Eligibility(true, null);
        }

        static Eligibility blocked(String reason) {
            return new Eligibility(false, reason);
        }
    }

    private final UserAccountRepository userAccountRepository;
    private final OperationsManagerRepository operationsManagerRepository;
    private final LocationManagerRepository locationManagerRepository;
    private final S5FleetClient fleetClient;
    private final S2PartnerClient partnerClient;

    public LoginEligibilityService(UserAccountRepository userAccountRepository,
            OperationsManagerRepository operationsManagerRepository,
            LocationManagerRepository locationManagerRepository,
            S5FleetClient fleetClient,
            S2PartnerClient partnerClient) {
        this.userAccountRepository = userAccountRepository;
        this.operationsManagerRepository = operationsManagerRepository;
        this.locationManagerRepository = locationManagerRepository;
        this.fleetClient = fleetClient;
        this.partnerClient = partnerClient;
    }

    /**
     * Rejects the login with the platform's existing 401 mechanism when the account, its role
     * assignment or any required parent is inactive. Call before issuing a token.
     */
    public void assertMayLogIn(UserAccount account) {
        Eligibility eligibility = evaluate(account);
        if (!eligibility.eligible()) {
            throw new InvalidCredentialsException(eligibility.reason());
        }
    }

    /** Eligibility of an account by id, for tokens already in circulation. Unknown id = not eligible. */
    public Eligibility evaluate(UUID userAccountId) {
        return userAccountRepository.findById(userAccountId)
                .map(this::evaluate)
                .orElseGet(() -> Eligibility.blocked("Account no longer exists"));
    }

    public Eligibility evaluate(UserAccount account) {
        if (!isActive(account.getAccountStatus())) {
            return Eligibility.blocked("Account is not active");
        }
        String role = account.getRole() == null ? "" : account.getRole().trim().toUpperCase();
        return switch (role) {
            case "OPERATIONS_MANAGER" -> evaluateOperationsManager(account);
            case "LOCATION_MANAGER" -> evaluateLocationManager(account);
            case "DRIVER" -> evaluateDriver(account);
            default -> Eligibility.ok();
        };
    }

    /** No assignment row at all is not treated as inactive (nothing to be inactive) - only an
     *  assignment that exists and is not ACTIVE blocks. */
    private Eligibility evaluateOperationsManager(UserAccount account) {
        return operationsManagerRepository.findByUserAccountId(account.getId())
                .filter(assignment -> assignment.getAssignmentStatus() != AssignmentStatus.ACTIVE)
                .map(assignment -> Eligibility.blocked("Your Operations Manager assignment is inactive"))
                .orElseGet(Eligibility::ok);
    }

    private Eligibility evaluateLocationManager(UserAccount account) {
        return locationManagerRepository.findWithSupervisorByUserAccountId(account.getId())
                .map(assignment -> {
                    if (assignment.getAssignmentStatus() != AssignmentStatus.ACTIVE) {
                        return Eligibility.blocked("Your Location Manager assignment is inactive");
                    }
                    var supervisor = assignment.getOperationsManager();
                    if (supervisor.getAssignmentStatus() != AssignmentStatus.ACTIVE
                            || !isActive(supervisor.getUserAccount().getAccountStatus())) {
                        return Eligibility.blocked("Your supervising Operations Manager is inactive");
                    }
                    return Eligibility.ok();
                })
                .orElseGet(Eligibility::ok);
    }

    private Eligibility evaluateDriver(UserAccount account) {
        try {
            S5FleetClient.DriverStatusResponse driver = fleetClient.getDriverByUserAccountId(account.getId());
            if (driver == null) {
                return Eligibility.ok();
            }
            if ("INACTIVE".equalsIgnoreCase(driver.driverStatus())) {
                return Eligibility.blocked("Your driver account is inactive");
            }
            if (driver.fleetOwnerId() != null) {
                S2PartnerClient.FleetOwnerValidationResponse owner = partnerClient.getFleetOwnerById(driver.fleetOwnerId());
                if (owner != null && owner.userAccountId() != null) {
                    boolean ownerAccountInactive = userAccountRepository.findById(owner.userAccountId())
                            .map(ownerAccount -> !isActive(ownerAccount.getAccountStatus()))
                            .orElse(false);
                    if (ownerAccountInactive) {
                        return Eligibility.blocked("Your fleet owner's account is inactive");
                    }
                }
            }
            return Eligibility.ok();
        } catch (RuntimeException lookupFailed) {
            log.debug("Could not verify driver hierarchy for account {} - allowing: {}", account.getId(), lookupFailed.toString());
            return Eligibility.ok();
        }
    }

    private static boolean isActive(String accountStatus) {
        return "ACTIVE".equalsIgnoreCase(accountStatus);
    }
}
