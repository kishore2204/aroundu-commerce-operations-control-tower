package com.cbg.lbos.client;

import com.cbg.lbos.dto.*;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

/**
 * The previous version of this client called "/api/fleet-owners/{id}/validation" on S2 with
 * no credentials - it now targets S2's real /internal/v1/fleet-owners/{id}/validation
 * endpoint, gated by the shared HTTP Basic credential (see ServiceBasicAuthFeignConfig).
 *
 * This used to also declare validateDriverByUserAccount, targeting S2 for driver validation -
 * removed, since S2 has no driver domain at all (Driver is owned by this service). See
 * DriverServiceImpl.create() and VehicleAssignmentServiceImpl.create() for what replaced it.
 */
@FeignClient(name = "lbos-partner", contextId = "s2PartnerClient", configuration = ServiceBasicAuthFeignConfig.class)
public interface S2PartnerClient {
	@GetMapping("/internal/v1/fleet-owners/{fleetOwnerId}/validation")
	FleetOwnerValidationDto validateFleetOwner(@PathVariable("fleetOwnerId") UUID fleetOwnerId);

	@GetMapping("/internal/v1/fleet-owners/by-user-account/{userAccountId}")
	FleetOwnerValidationDto getFleetOwnerByUserAccountId(@PathVariable("userAccountId") UUID userAccountId);
}

