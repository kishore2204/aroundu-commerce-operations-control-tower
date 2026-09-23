package com.cbg.lbos.controller;

import com.cbg.lbos.dto.LogisticsBookingDetailDto;
import com.cbg.lbos.service.LogisticsBookingDetailService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/logistics-bookings")
public class LogisticsBookingDetailController {

    private final LogisticsBookingDetailService logisticsBookingDetailService;

    public LogisticsBookingDetailController(LogisticsBookingDetailService logisticsBookingDetailService) {
        this.logisticsBookingDetailService = logisticsBookingDetailService;
    }

    @PostMapping
    public ResponseEntity<LogisticsBookingDetailDto> create(@Valid @RequestBody LogisticsBookingDetailDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(logisticsBookingDetailService.create(dto));
    }

    /** The price of a booking before it is created (same calculation as create) - shown on the payment screen. */
    @PostMapping("/quote")
    public ResponseEntity<com.cbg.lbos.dto.LogisticsQuoteResponse> quote(@RequestBody com.cbg.lbos.dto.LogisticsQuoteRequest request) {
        return ResponseEntity.ok(logisticsBookingDetailService.quote(request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<LogisticsBookingDetailDto> getById(@PathVariable Long id) {
        return ResponseEntity.ok(logisticsBookingDetailService.getById(id));
    }

    @GetMapping
    public ResponseEntity<List<LogisticsBookingDetailDto>> getAll() {
        return ResponseEntity.ok(logisticsBookingDetailService.getAll());
    }

    @PutMapping("/{id}")
    public ResponseEntity<LogisticsBookingDetailDto> update(
            @PathVariable Long id,
            @Valid @RequestBody LogisticsBookingDetailDto dto) {
        return ResponseEntity.ok(logisticsBookingDetailService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        logisticsBookingDetailService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
