package com.cbg.lbos.service;

import java.util.UUID;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.cbg.lbos.dto.ZoneDto;
import com.cbg.lbos.entity.*;
import com.cbg.lbos.exception.*;
import com.cbg.lbos.repository.*;

@Service
@Transactional
public class ZoneServiceImpl implements ZoneService {
    private final ZoneRepository zoneRepository;
    private final CityRepository cityRepository;
    private final LocationManagerRepository locationManagerRepository;

    public ZoneServiceImpl(ZoneRepository zoneRepository, CityRepository cityRepository,
                           LocationManagerRepository locationManagerRepository) {
        this.zoneRepository = zoneRepository;
        this.cityRepository = cityRepository;
        this.locationManagerRepository = locationManagerRepository;
    }

    public ZoneDto createZone(ZoneDto zoneDto) {
        City city = findCity(zoneDto.getCityId());
        validateActiveCity(city);
        String zoneName = normalizeZoneName(zoneDto.getZoneName());
        validateDuplicateZoneName(city.getId(), zoneName, null);
        Zone zone = new Zone();
        zone.setCity(city);
        zone.setZoneName(zoneName);
        zone.setIsActive(true);
        return toDto(zoneRepository.save(zone));
    }

    @Transactional(readOnly = true)
    public ZoneDto getZoneById(UUID zoneId) { return toDto(findZone(zoneId)); }

    @Transactional(readOnly = true)
    public Page<ZoneDto> getZones(UUID cityId, Boolean active, Pageable pageable) {
        if (cityId != null) findCity(cityId);
        return zoneRepository.search(cityId, active, pageable).map(this::toDto);
    }

    public ZoneDto updateZone(UUID zoneId, ZoneDto zoneDto) {
        Zone zone = findZone(zoneId);
        String zoneName = normalizeZoneName(zoneDto.getZoneName());
        validateDuplicateZoneName(zone.getCity().getId(), zoneName, zoneId);
        zone.setZoneName(zoneName);
        return toDto(zoneRepository.save(zone));
    }

    public ZoneDto activateZone(UUID zoneId) {
        Zone zone = findZone(zoneId);
        validateActiveCity(zone.getCity());
        zone.setIsActive(true);
        return toDto(zoneRepository.save(zone));
    }

    public ZoneDto deactivateZone(UUID zoneId) {
        Zone zone = findZone(zoneId);
        if (locationManagerRepository.existsByZoneIdAndAssignmentStatus(zoneId, AssignmentStatus.ACTIVE)) {
            throw new InvalidAssignmentException("Zone has an active Location Manager");
        }
        zone.setIsActive(false);
        return toDto(zoneRepository.save(zone));
    }

    private City findCity(UUID cityId) {
        return cityRepository.findById(cityId)
                .orElseThrow(() -> new ResourceNotFoundException("City not found: " + cityId));
    }

    private Zone findZone(UUID zoneId) {
        return zoneRepository.findById(zoneId)
                .orElseThrow(() -> new ResourceNotFoundException("Zone not found: " + zoneId));
    }

    private void validateActiveCity(City city) {
        if (!Boolean.TRUE.equals(city.getIsActive())) {
            throw new InvalidAssignmentException("Selected City is inactive");
        }
    }

    private String normalizeZoneName(String zoneName) { return zoneName.trim().replaceAll("\\s+", " "); }

    private void validateDuplicateZoneName(UUID cityId, String zoneName, UUID excludedZoneId) {
        boolean duplicate = excludedZoneId == null
                ? zoneRepository.existsByCityIdAndZoneNameIgnoreCase(cityId, zoneName)
                : zoneRepository.existsByCityIdAndZoneNameIgnoreCaseAndIdNot(cityId, zoneName, excludedZoneId);
        if (duplicate) throw new DuplicateResourceException("Zone name already exists in the City");
    }

    private ZoneDto toDto(Zone zone) {
        ZoneDto zoneDto = new ZoneDto();
        zoneDto.setZoneId(zone.getId());
        zoneDto.setZoneName(zone.getZoneName());
        zoneDto.setActive(zone.getIsActive());
        zoneDto.setCityId(zone.getCity().getId());
        zoneDto.setCityName(zone.getCity().getCityName());
        zoneDto.setStateId(zone.getCity().getState().getId());
        zoneDto.setStateName(zone.getCity().getState().getStateName());
        return zoneDto;
    }
}
