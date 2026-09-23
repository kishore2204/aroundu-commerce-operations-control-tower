package com.cbg.lbos.controller;

import com.cbg.lbos.dto.LogisticsVehicleRateDto;
import com.cbg.lbos.service.LogisticsRateService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/logistics-rates")
public class LogisticsRateController {
    private final LogisticsRateService rates;
    public LogisticsRateController(LogisticsRateService rates) { this.rates = rates; }

    @GetMapping
    public ResponseEntity<List<LogisticsVehicleRateDto>> list() { return ResponseEntity.ok(rates.getAll()); }

    @PutMapping("/{vehicleCategory}")
    public ResponseEntity<LogisticsVehicleRateDto> update(@PathVariable String vehicleCategory,
            @RequestBody LogisticsVehicleRateDto request) {
        return ResponseEntity.ok(rates.update(vehicleCategory, request));
    }
}
