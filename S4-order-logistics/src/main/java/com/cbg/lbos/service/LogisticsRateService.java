package com.cbg.lbos.service;

import com.cbg.lbos.dto.LogisticsVehicleRateDto;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/**
 * Runtime tariff registry. It intentionally does not add/change database tables. Defaults are
 * initialized on startup and Operations Manager updates take effect immediately for new bookings.
 */
@Service
public class LogisticsRateService {
    private final Map<String, LogisticsVehicleRateDto> rates = new ConcurrentHashMap<>();

    public LogisticsRateService() {
        putDefault("BIKE", "10", "2", "50");
        putDefault("SCOOTY", "10", "2", "50");
        putDefault("AUTO", "14", "3", "80");
        putDefault("SMALL_TRUCK", "20", "5", "150");
        putDefault("FOUR_WHEEL_TRUCK", "28", "5", "250");
        putDefault("EIGHT_WHEEL_TRUCK", "40", "10", "500");
        putDefault("SIXTEEN_WHEEL_TRUCK", "60", "10", "800");
    }

    private void putDefault(String category, String ratePerKm, String minimumDistance, String minimumRate) {
        rates.put(category, new LogisticsVehicleRateDto(category, new BigDecimal(ratePerKm),
                new BigDecimal(minimumDistance), new BigDecimal(minimumRate)));
    }

    public List<LogisticsVehicleRateDto> getAll() {
        List<String> order = List.of("BIKE", "SCOOTY", "AUTO", "SMALL_TRUCK", "FOUR_WHEEL_TRUCK",
                "EIGHT_WHEEL_TRUCK", "SIXTEEN_WHEEL_TRUCK");
        return order.stream().map(rates::get).toList();
    }

    /** The tariff of a vehicle category, or empty when the value is not a category we price (a blank value is NOT
     *  defaulted to a category here, unlike {@link #normalize}). */
    public java.util.Optional<LogisticsVehicleRateDto> find(String category) {
        if (category == null || category.isBlank()) return java.util.Optional.empty();
        return java.util.Optional.ofNullable(rates.get(normalize(category)));
    }

    public LogisticsVehicleRateDto get(String category) {
        String normalized = normalize(category);
        LogisticsVehicleRateDto rate = rates.get(normalized);
        if (rate == null) throw new IllegalArgumentException("Unsupported vehicle category: " + category);
        return rate;
    }

    public LogisticsVehicleRateDto update(String category, LogisticsVehicleRateDto request) {
        String normalized = normalize(category);
        if (!rates.containsKey(normalized)) throw new IllegalArgumentException("Unsupported vehicle category: " + category);
        if (request == null || positive(request.ratePerKm()) == false || positive(request.minimumDistanceKm()) == false
                || positive(request.minimumRate()) == false) {
            throw new IllegalArgumentException("Rate per km, minimum distance and minimum rate must be greater than zero");
        }
        LogisticsVehicleRateDto updated = new LogisticsVehicleRateDto(normalized, request.ratePerKm(),
                request.minimumDistanceKm(), request.minimumRate());
        rates.put(normalized, updated);
        return updated;
    }

    private boolean positive(BigDecimal value) { return value != null && value.signum() > 0; }

    public String normalize(String category) {
        if (category == null || category.isBlank()) return "FOUR_WHEEL_TRUCK";
        return switch (category.trim().toUpperCase()) {
            case "TWO_WHEELER", "MOTORCYCLE" -> "BIKE";
            case "TRUCK" -> "FOUR_WHEEL_TRUCK";
            case "MINI_TRUCK" -> "SMALL_TRUCK";
            case "HEAVY_TRUCK" -> "EIGHT_WHEEL_TRUCK";
            default -> category.trim().toUpperCase();
        };
    }
}
