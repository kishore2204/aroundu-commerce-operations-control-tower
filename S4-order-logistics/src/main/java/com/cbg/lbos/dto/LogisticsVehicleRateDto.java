package com.cbg.lbos.dto;

import java.math.BigDecimal;

/** No-schema runtime logistics tariff configuration. */
public record LogisticsVehicleRateDto(
        String vehicleCategory,
        BigDecimal ratePerKm,
        BigDecimal minimumDistanceKm,
        BigDecimal minimumRate) {
}
