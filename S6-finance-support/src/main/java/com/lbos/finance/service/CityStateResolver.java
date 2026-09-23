package com.lbos.finance.service;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import com.lbos.finance.integration.client.TerritoryServiceClient;

/**
 * Decides which state a delivery city is in, from S1's territory data. Cities and their states are static
 * reference data, so the whole active-city list is read once and reused for a while instead of calling S1 for
 * every checkout; an unknown city triggers at most one refresh a minute (a city added after the last load),
 * and if S1 cannot be reached the last successful load keeps serving.
 */
@Component
public class CityStateResolver {

    private static final Duration TTL = Duration.ofMinutes(30);
    private static final Duration MIN_REFRESH_INTERVAL = Duration.ofMinutes(1);

    private final TerritoryServiceClient territoryServiceClient;
    private volatile Map<UUID, UUID> stateByCity = Map.of();
    private volatile Instant loadedAt = Instant.MIN;

    public CityStateResolver(TerritoryServiceClient territoryServiceClient) {
        this.territoryServiceClient = territoryServiceClient;
    }

    public Optional<UUID> stateOf(UUID cityId) {
        if (cityId == null) return Optional.empty();
        if (loadedAt.plus(TTL).isBefore(Instant.now())) refresh();
        UUID stateId = stateByCity.get(cityId);
        if (stateId == null && loadedAt.plus(MIN_REFRESH_INTERVAL).isBefore(Instant.now())) {
            refresh();
            stateId = stateByCity.get(cityId);
        }
        return Optional.ofNullable(stateId);
    }

    private synchronized void refresh() {
        if (!loadedAt.plus(MIN_REFRESH_INTERVAL).isBefore(Instant.now())) return; // someone just refreshed
        try {
            List<TerritoryServiceClient.CitySummary> cities = territoryServiceClient.activeCities();
            Map<UUID, UUID> fresh = new HashMap<>();
            if (cities != null) {
                for (TerritoryServiceClient.CitySummary city : cities) {
                    if (city.cityId() != null && city.stateId() != null) fresh.put(city.cityId(), city.stateId());
                }
            }
            stateByCity = Map.copyOf(fresh);
            loadedAt = Instant.now();
        } catch (RuntimeException failure) {
            if (stateByCity.isEmpty()) throw failure; // nothing to fall back on
            loadedAt = Instant.now().minus(TTL).plus(MIN_REFRESH_INTERVAL); // keep serving the last load, retry in a minute
        }
    }
}
