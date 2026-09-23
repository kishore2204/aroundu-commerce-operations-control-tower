package com.lbos.finance.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.lbos.finance.dto.AnalyticsOverviewResponse;
import com.lbos.finance.dto.RefundRegionInsightResponse;
import com.lbos.finance.service.AnalyticsService;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/overview")
    public ResponseEntity<AnalyticsOverviewResponse> getOverview() {
        return ResponseEntity.ok(analyticsService.getOverview());
    }

    @GetMapping("/refunds/by-region")
    public ResponseEntity<List<RefundRegionInsightResponse>> getRefundRegionInsights() {
        return ResponseEntity.ok(analyticsService.getRefundRegionInsights());
    }
}
