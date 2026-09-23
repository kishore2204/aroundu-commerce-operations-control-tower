package com.cbg.lbos.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.cbg.lbos.dto.TerritoryValidationRequest;
import com.cbg.lbos.dto.TerritoryValidationResponse;
import com.cbg.lbos.entity.City;
import com.cbg.lbos.entity.Zone;
import com.cbg.lbos.repository.CityRepository;
import com.cbg.lbos.repository.ZoneRepository;
import com.cbg.lbos.service.TerritoryValidationService;

/**
 * Service-to-service territory validation (e.g. S3 validating a CustomerAddress's
 * city/zone before create/update). Gated by hasRole("SERVICE") like the other
 * /internal/** endpoints - not for browser/end-user use.
 */
@RestController
@RequestMapping("/internal/v1/territories")
public class InternalTerritoryController {
    private final TerritoryValidationService territoryValidationService;
    private final CityRepository cityRepository;
    private final ZoneRepository zoneRepository;

    public InternalTerritoryController(TerritoryValidationService territoryValidationService,
            CityRepository cityRepository, ZoneRepository zoneRepository) {
        this.territoryValidationService = territoryValidationService;
        this.cityRepository = cityRepository;
        this.zoneRepository = zoneRepository;
    }

    @PostMapping("/validate")
    public TerritoryValidationResponse validate(@RequestBody TerritoryValidationRequest request) {
        return territoryValidationService.validate(request);
    }

    public record CityLookupResponse(UUID cityId, String cityName, UUID stateId, String stateName) {
    }

    public record ZoneLookupResponse(UUID zoneId, String zoneName, UUID cityId) {
    }

    /**
     * Lets a caller (e.g. S3 resolving a customer-typed city name to S1's internal UUID for an
     * address) look up active cities by a human-readable name, without needing the
     * SUPER_ADMIN/OPERATIONS_MANAGER role the public GET /api/v1/cities requires. Blank/absent
     * name returns every active city, so the same endpoint also serves a "pick from a list" UI.
     */
    @GetMapping("/cities")
    @Transactional(readOnly = true)
    public List<CityLookupResponse> cities(@RequestParam(required = false) String name) {
        List<City> cities = (name == null || name.isBlank())
                ? cityRepository.findByIsActiveTrue()
                : cityRepository.findByIsActiveTrueAndCityNameContainingIgnoreCase(name.trim());
        return cities.stream()
                .map(c -> new CityLookupResponse(c.getId(), c.getCityName(), c.getState().getId(), c.getState().getStateName()))
                .toList();
    }

    /** Same idea as {@link #cities}, scoped to one city's active zones. */
    @GetMapping("/zones")
    @Transactional(readOnly = true)
    public List<ZoneLookupResponse> zones(@RequestParam UUID cityId, @RequestParam(required = false) String name) {
        List<Zone> zones = (name == null || name.isBlank())
                ? zoneRepository.findByCity_IdAndIsActiveTrue(cityId)
                : zoneRepository.findByCity_IdAndIsActiveTrueAndZoneNameContainingIgnoreCase(cityId, name.trim());
        return zones.stream()
                .map(z -> new ZoneLookupResponse(z.getId(), z.getZoneName(), z.getCity().getId()))
                .toList();
    }

    /**
     * Every active zone across several cities in ONE call - added for S3's address list, which
     * previously called {@link #zones} once per distinct city among a customer's saved addresses
     * (a customer with addresses in N cities cost N sequential Feign round trips just to label
     * the list with zone names). cityIds is capped at 50, matching the realistic "how many
     * different cities can one customer's own addresses span" bound - this is a display-name
     * lookup, not a general-purpose bulk export.
     */
    @GetMapping("/zones/by-cities")
    @Transactional(readOnly = true)
    public List<ZoneLookupResponse> zonesByCities(@RequestParam List<UUID> cityIds) {
        if (cityIds.isEmpty() || cityIds.size() > 50) {
            throw new IllegalArgumentException("cityIds must have between 1 and 50 entries");
        }
        return zoneRepository.findByCity_IdInAndIsActiveTrue(cityIds).stream()
                .map(z -> new ZoneLookupResponse(z.getId(), z.getZoneName(), z.getCity().getId()))
                .toList();
    }
}
