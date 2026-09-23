package com.example.lbos.controller;

import com.example.lbos.dto.LocationDashboardDTOs.FleetAssets;
import com.example.lbos.dto.LocationDashboardDTOs.ReviewPage;
import com.example.lbos.dto.LocationDashboardDTOs.Summary;
import com.example.lbos.dto.LocationDashboardDTOs.UserPage;
import com.example.lbos.service.LocationDashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

/**
 * The Location Manager's zone dashboard. LOCATION_MANAGER only (SecurityConfig); the zone is never a parameter - it is
 * the caller's own assignment, resolved on the server, so another zone's data cannot be asked for.
 */
@RestController
@RequestMapping("/api/location-dashboard")
@Tag(name = "Location Manager Dashboard", description = "Zone-scoped KPIs, analytics and partner lists for a Location Manager")
public class LocationDashboardController {

    private final LocationDashboardService service;

    public LocationDashboardController(LocationDashboardService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    @Operation(summary = "KPIs and analytics for the caller's zone",
            description = "Date range affects the time-based figures (decisions, completed orders, onboarding trend); totals and pending work are current state")
    public ResponseEntity<Summary> summary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(service.summary(from, to));
    }

    @GetMapping("/users")
    @Operation(summary = "Retailers or fleet owners of the caller's zone",
            description = "Paged; search, filters and sorting are applied in the database")
    public ResponseEntity<UserPage> users(
            @RequestParam(defaultValue = "RETAILER") String type,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String onboardingStatus,
            @RequestParam(required = false) String verificationStatus,
            @RequestParam(required = false) String activation,
            @RequestParam(required = false) String pendingAction,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String direction,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(service.users(new LocationDashboardService.UserQuery(
                type, search, onboardingStatus, verificationStatus, activation, pendingAction, sort, direction, page, size)));
    }

    @GetMapping("/retailers/{retailerId}/reviews")
    @Operation(summary = "Customer reviews of one retailer of the caller's zone")
    public ResponseEntity<ReviewPage> retailerReviews(@PathVariable UUID retailerId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "5") int size) {
        return ResponseEntity.ok(service.retailerReviews(retailerId, page, size));
    }

    @GetMapping("/fleet-owners/{fleetOwnerId}/assets")
    @Operation(summary = "Drivers and vehicles of one fleet owner of the caller's zone")
    public ResponseEntity<FleetAssets> fleetAssets(@PathVariable UUID fleetOwnerId) {
        return ResponseEntity.ok(service.fleetAssets(fleetOwnerId));
    }
}
