package com.cbg.lbos.service;

import org.springframework.stereotype.Service;

import com.cbg.lbos.dto.TerritoryValidationRequest;
import com.cbg.lbos.dto.TerritoryValidationResponse;
import com.cbg.lbos.entity.City;
import com.cbg.lbos.entity.Zone;
import com.cbg.lbos.repository.CityRepository;
import com.cbg.lbos.repository.ZoneRepository;

/**
 * Backs the {@code /internal/v1/territories/validate} endpoint that S3 (lbos-commerce) calls
 * before creating or updating a customer address. Only checks what City/Zone actually model
 * (existence, active status, and zone-belongs-to-city) - postalCode/latitude/longitude are
 * accepted as-is since no corresponding reference data exists in this service.
 */
@Service
public class TerritoryValidationService {
    private final CityRepository cityRepository;
    private final ZoneRepository zoneRepository;

    public TerritoryValidationService(CityRepository cityRepository, ZoneRepository zoneRepository) {
        this.cityRepository = cityRepository;
        this.zoneRepository = zoneRepository;
    }

    public TerritoryValidationResponse validate(TerritoryValidationRequest request) {
        if (request.cityId() == null) {
            return new TerritoryValidationResponse(false, "CITY_ID_REQUIRED");
        }
        City city = cityRepository.findById(request.cityId()).orElse(null);
        if (city == null) {
            return new TerritoryValidationResponse(false, "CITY_NOT_FOUND");
        }
        if (!Boolean.TRUE.equals(city.getIsActive())) {
            return new TerritoryValidationResponse(false, "CITY_INACTIVE");
        }
        if (request.zoneId() != null) {
            Zone zone = zoneRepository.findById(request.zoneId()).orElse(null);
            if (zone == null) {
                return new TerritoryValidationResponse(false, "ZONE_NOT_FOUND");
            }
            if (!zone.getCity().getId().equals(request.cityId())) {
                return new TerritoryValidationResponse(false, "ZONE_CITY_MISMATCH");
            }
            if (!Boolean.TRUE.equals(zone.getIsActive())) {
                return new TerritoryValidationResponse(false, "ZONE_INACTIVE");
            }
        }
        return new TerritoryValidationResponse(true, null);
    }
}
