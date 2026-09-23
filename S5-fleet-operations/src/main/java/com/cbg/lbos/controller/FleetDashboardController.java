package com.cbg.lbos.controller;

import com.cbg.lbos.client.S2PartnerClient;
import com.cbg.lbos.dto.FleetDashboardStatsDto;
import com.cbg.lbos.dto.FleetOwnerValidationDto;
import com.cbg.lbos.entity.AssignmentStatus;
import com.cbg.lbos.entity.DriverStatus;
import com.cbg.lbos.entity.FleetExpense;
import com.cbg.lbos.entity.VehicleStatus;
import com.cbg.lbos.repository.DriverRepository;
import com.cbg.lbos.repository.FleetExpenseRepository;
import com.cbg.lbos.repository.VehicleAssignmentRepository;
import com.cbg.lbos.repository.VehicleRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/fleet")
public class FleetDashboardController {

    private final DriverRepository driverRepository;
    private final VehicleRepository vehicleRepository;
    private final VehicleAssignmentRepository assignmentRepository;
    private final FleetExpenseRepository expenseRepository;
    private final S2PartnerClient partnerClient;

    public FleetDashboardController(
            DriverRepository driverRepository,
            VehicleRepository vehicleRepository,
            VehicleAssignmentRepository assignmentRepository,
            FleetExpenseRepository expenseRepository,
            S2PartnerClient partnerClient) {
        this.driverRepository = driverRepository;
        this.vehicleRepository = vehicleRepository;
        this.assignmentRepository = assignmentRepository;
        this.expenseRepository = expenseRepository;
        this.partnerClient = partnerClient;
    }

    @GetMapping("/dashboard/stats")
    public ResponseEntity<FleetDashboardStatsDto> getStats(
            @RequestParam(required = false) UUID fleetOwnerId,
            Authentication authentication) {

        UUID targetFleetOwnerId = fleetOwnerId;
        if (targetFleetOwnerId == null && authentication != null && authentication.getName() != null) {
            try {
                UUID userAccountId = UUID.fromString(authentication.getName());
                FleetOwnerValidationDto validation = partnerClient.getFleetOwnerByUserAccountId(userAccountId);
                if (validation != null) {
                    targetFleetOwnerId = validation.getFleetOwnerId();
                }
            } catch (Exception ignored) {
            }
        }

        FleetDashboardStatsDto stats = new FleetDashboardStatsDto();
        stats.setFleetOwnerId(targetFleetOwnerId);

        if (targetFleetOwnerId == null) {
            stats.setTotalDrivers(0);
            stats.setActiveDrivers(0);
            stats.setTotalVehicles(0);
            stats.setActiveVehicles(0);
            stats.setActiveAssignments(0);
            stats.setTotalExpenses(BigDecimal.ZERO);
            return ResponseEntity.ok(stats);
        }

        var drivers = driverRepository.findByFleetOwnerId(targetFleetOwnerId);
        stats.setTotalDrivers(drivers.size());
        stats.setActiveDrivers(drivers.stream().filter(d -> d.getDriverStatus() == DriverStatus.ACTIVE).count());

        var vehicles = vehicleRepository.findByFleetOwnerId(targetFleetOwnerId);
        stats.setTotalVehicles(vehicles.size());
        stats.setActiveVehicles(vehicles.stream().filter(v -> v.getVehicleStatus() == VehicleStatus.ACTIVE).count());

        var vehicleIds = vehicles.stream().map(com.cbg.lbos.entity.Vehicle::getVehicleId).toList();
        var assignments = vehicleIds.isEmpty() ? List.<com.cbg.lbos.entity.VehicleAssignment>of()
                : assignmentRepository.findByVehicleIdIn(vehicleIds);
        stats.setActiveAssignments(assignments.stream().filter(a -> a.getAssignmentStatus() == AssignmentStatus.ACTIVE).count());

        List<FleetExpense> expenses = expenseRepository.findByFleetOwnerId(targetFleetOwnerId);
        BigDecimal totalExp = expenses.stream()
                .map(FleetExpense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        stats.setTotalExpenses(totalExp);

        return ResponseEntity.ok(stats);
    }
}
