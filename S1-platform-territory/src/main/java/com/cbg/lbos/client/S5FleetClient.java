package com.cbg.lbos.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.UUID;

/**
 * Feign client for S5's internal driver lookup, used at login to tell a driver whose documents
 * are still awaiting approval why they cannot sign in yet. S5 owns Driver operational data -
 * S1's UserAccount row has no equivalent field, since a driver's account is created ACTIVE and
 * only the Driver record carries the PENDING/INACTIVE approval state.
 */
@FeignClient(name = "lbos-fleet", contextId = "platformFleetClient", configuration = ServiceBasicAuthFeignConfig.class)
public interface S5FleetClient {

    /**
     * Looks up the driver linked to a user account.
     *
     * @param userAccountId the user account id whose driver record is requested
     * @return the driver's status summary
     */
    @GetMapping("/internal/v1/drivers/by-user-account/{userAccountId}")
    DriverStatusResponse getDriverByUserAccountId(@PathVariable("userAccountId") UUID userAccountId);

    /**
     * The only part of S5's DriverDto this service cares about. Unmapped fields are ignored by
     * Jackson's default lenient deserialization, so this stays a narrow projection rather than a
     * copy of the full DTO.
     *
     * @param driverId the driver id
     * @param driverStatus the driver's lifecycle status (PENDING/ACTIVE/INACTIVE/SUSPENDED/...)
     * @param fleetOwnerId the owning fleet owner - the driver's parent in the role hierarchy,
     *        read by LoginEligibilityService
     */
    record DriverStatusResponse(UUID driverId, String driverStatus, UUID fleetOwnerId) {
    }
}
