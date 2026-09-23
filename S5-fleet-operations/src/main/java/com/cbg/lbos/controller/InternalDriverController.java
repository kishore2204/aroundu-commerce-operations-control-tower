package com.cbg.lbos.controller;

import com.cbg.lbos.dto.DriverDto;
import com.cbg.lbos.service.DriverService;
import org.springframework.web.bind.annotation.*;

/**
 * Service-to-service Driver creation, added for the Fleet-Owner-initiated onboarding flow: S2
 * (FleetOwnerAssetServiceImpl) creates the actual Driver record here on behalf of a Fleet Owner
 * adding a driver through S2's onboarding endpoint, then opens a verification-queue entry for it
 * itself - S5 still owns Driver operational data and its create() validation (fleet owner
 * verified/active, license not expired, no duplicate license/account), this just exposes the
 * same DriverService.create() on the SERVICE-role Basic-auth surface instead of requiring a
 * FLEET_MANAGER JWT, since the caller here is S2, not an end user. Gated by hasRole("SERVICE")
 * like the other /internal/** endpoints - not for browser/end-user use.
 */
@RestController
@RequestMapping("/internal/v1/drivers")
public class InternalDriverController {

    private final DriverService driverService;

    public InternalDriverController(DriverService driverService) {
        this.driverService = driverService;
    }

    @PostMapping
    public DriverDto create(@RequestBody DriverDto driverDto) {
        return driverService.create(driverDto);
    }

    @GetMapping("/{id}")
    public DriverDto get(@PathVariable("id") java.util.UUID id) {
        return driverService.get(id);
    }

    @GetMapping("/by-user-account/{userAccountId}")
    public DriverDto getByUserAccountId(@PathVariable("userAccountId") java.util.UUID userAccountId) {
        return driverService.getByUserAccountId(userAccountId);
    }
}

