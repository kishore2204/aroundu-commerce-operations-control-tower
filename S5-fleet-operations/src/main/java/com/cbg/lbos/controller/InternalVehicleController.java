package com.cbg.lbos.controller;

import com.cbg.lbos.dto.VehicleDto;
import com.cbg.lbos.service.VehicleService;
import org.springframework.web.bind.annotation.*;

/**
 * Service-to-service Vehicle creation - see InternalDriverController for the equivalent Driver
 * endpoint and the rationale. Gated by hasRole("SERVICE") like the other /internal/** endpoints.
 */
@RestController
@RequestMapping("/internal/v1/vehicles")
public class InternalVehicleController {

    private final VehicleService vehicleService;

    public InternalVehicleController(VehicleService vehicleService) {
        this.vehicleService = vehicleService;
    }

    @PostMapping
    public VehicleDto create(@RequestBody VehicleDto vehicleDto) {
        return vehicleService.create(vehicleDto);
    }
}
