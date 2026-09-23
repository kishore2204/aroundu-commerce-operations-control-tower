package com.cbg.lbos.controller;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.cbg.lbos.dto.DriverDto;
import com.cbg.lbos.dto.VehicleDto;
import com.cbg.lbos.entity.DriverStatus;
import com.cbg.lbos.entity.VehicleStatus;
import com.cbg.lbos.service.DriverService;
import com.cbg.lbos.service.VehicleService;

/**
 * Service-to-service lookup of driver/vehicle data (S4 resolving a trip's assigned driver
 * and vehicle - see S4's DriverClient/VehicleClient, which previously called the public
 * /api/drivers/{id} and /api/vehicles/{id} with no credentials since this service had no
 * security at all), plus service-to-service activation once S2's verification workflow
 * approves a driver/vehicle's documents (see S2's VerificationQueueServiceImpl.
 * processVerificationResult and its new S5FleetClient). Gated by hasRole("SERVICE") like the
 * other /internal/v1/** endpoints - not for browser/end-user use. The GETs return the same DTO
 * shape the public endpoints always returned, so S4's existing DriverSummary/VehicleSummary
 * record mapping is unaffected.
 */
@RestController
@RequestMapping("/internal/v1")
public class InternalFleetController {

    private final DriverService driverService;
    private final VehicleService vehicleService;

    public InternalFleetController(DriverService driverService, VehicleService vehicleService) {
        this.driverService = driverService;
        this.vehicleService = vehicleService;
    }

    @GetMapping("/vehicles/{id}")
    public VehicleDto getVehicle(@PathVariable UUID id) {
        return vehicleService.get(id);
    }

    /** A fleet owner's drivers, for S2's Location Manager dashboard (which has already checked the owner is in the caller's zone). */
    @GetMapping("/fleet-owners/{fleetOwnerId}/drivers")
    public List<DriverDto> driversOf(@PathVariable UUID fleetOwnerId) {
        return driverService.getByFleetOwner(fleetOwnerId);
    }

    /** A fleet owner's vehicles - same caller and purpose as the drivers lookup above. */
    @GetMapping("/fleet-owners/{fleetOwnerId}/vehicles")
    public List<VehicleDto> vehiclesOf(@PathVariable UUID fleetOwnerId) {
        return vehicleService.getByFleetOwner(fleetOwnerId);
    }

    /**
     * Called by S2 once a DRIVER verification-queue entry is APPROVED. A direct status flip to
     * ACTIVE - no license-expiry re-check here, that was already validated at creation time in
     * DriverServiceImpl.create(). Distinct from the JWT-facing PATCH /api/drivers/{id}/status,
     * which expects a human caller and takes an arbitrary target status. POST rather than PATCH:
     * Feign's default client (java.net.HttpURLConnection-based) doesn't support the PATCH verb
     * at all ("Invalid HTTP method: PATCH") - confirmed live when S2's Feign call to this
     * endpoint failed with exactly that error. POST is a fine fit anyway since this is an
     * action-trigger endpoint, not a strict partial-update.
     */
    @PostMapping("/drivers/{id}/activate")
    public DriverDto activateDriver(@PathVariable UUID id) {
        return driverService.activate(id);
    }

    /**
     * Called by S2 once a VEHICLE verification-queue entry is APPROVED. Same shape as
     * activateDriver above.
     */
    @PostMapping("/vehicles/{id}/activate")
    public VehicleDto activateVehicle(@PathVariable UUID id) {
        return vehicleService.activate(id);
    }

    /**
     * Called by S2 when a Location Manager revokes a previously-APPROVED DRIVER verification
     * (see VerificationQueueServiceImpl.revokeApproval) - blocks the driver by flipping it to
     * SUSPENDED. Same shape/rationale (POST, not PATCH) as activateDriver above.
     */
    @PostMapping("/drivers/{id}/suspend")
    public DriverDto suspendDriver(@PathVariable UUID id) {
        return driverService.changeStatus(id, DriverStatus.SUSPENDED);
    }

    /** Same idea as suspendDriver above, for a VEHICLE. */
    @PostMapping("/vehicles/{id}/suspend")
    public VehicleDto suspendVehicle(@PathVariable UUID id) {
        return vehicleService.changeStatus(id, VehicleStatus.SUSPENDED, null);
    }

    /**
     * Nearest ACTIVE, unassigned vehicles/drivers to a delivery address - called by S4's
     * OrderService.retailerAccept() once a retailer accepts a retail order, to find and notify
     * the nearest fleet owner. maxKm is optional (no cap when omitted).
     */
    @GetMapping("/vehicles/nearest-available")
    public List<VehicleDto> nearestAvailableVehicles(
            @RequestParam BigDecimal lat, @RequestParam BigDecimal lon,
            @RequestParam(required = false) Double maxKm) {
        return vehicleService.nearestAvailable(lat, lon, maxKm);
    }

    @GetMapping("/drivers/nearest-available")
    public List<DriverDto> nearestAvailableDrivers(
            @RequestParam BigDecimal lat, @RequestParam BigDecimal lon,
            @RequestParam(required = false) Double maxKm) {
        return driverService.nearestAvailable(lat, lon, maxKm);
    }
}
