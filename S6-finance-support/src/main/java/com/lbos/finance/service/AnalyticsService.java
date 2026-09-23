package com.lbos.finance.service;

import java.util.List;

import com.lbos.finance.dto.AnalyticsOverviewResponse;
import com.lbos.finance.dto.RefundRegionInsightResponse;

public interface AnalyticsService {
    AnalyticsOverviewResponse getOverview();

    /**
     * Aggregates refund requests by the delivery region already stored on the linked order.
     * No additional refund/location table is introduced for this reporting view.
     */
    List<RefundRegionInsightResponse> getRefundRegionInsights();
}
