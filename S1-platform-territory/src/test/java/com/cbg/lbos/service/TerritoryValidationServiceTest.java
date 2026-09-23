package com.cbg.lbos.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.Optional;
import java.util.UUID;

import com.cbg.lbos.dto.TerritoryValidationRequest;
import com.cbg.lbos.dto.TerritoryValidationResponse;
import com.cbg.lbos.entity.City;
import com.cbg.lbos.entity.Zone;
import com.cbg.lbos.repository.CityRepository;
import com.cbg.lbos.repository.ZoneRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TerritoryValidationServiceTest {
    @Mock CityRepository cityRepository;
    @Mock ZoneRepository zoneRepository;

    private TerritoryValidationService territoryValidationService;
    private UUID cityId;
    private UUID zoneId;
    private City activeCity;
    private Zone activeZone;

    @BeforeEach
    void setUp() {
        territoryValidationService = new TerritoryValidationService(cityRepository, zoneRepository);
        cityId = UUID.randomUUID();
        zoneId = UUID.randomUUID();
        activeCity = new City();
        activeCity.setId(cityId);
        activeCity.setIsActive(true);
        activeZone = new Zone();
        activeZone.setCity(activeCity);
        activeZone.setIsActive(true);
    }

    @Test
    void rejectsMissingCityId() {
        TerritoryValidationResponse response = territoryValidationService.validate(
                new TerritoryValidationRequest(null, null, null, null, null));
        assertFalse(response.valid());
        assertEquals("CITY_ID_REQUIRED", response.reasonCode());
        verifyNoInteractions(cityRepository, zoneRepository);
    }

    @Test
    void rejectsUnknownCity() {
        when(cityRepository.findById(cityId)).thenReturn(Optional.empty());
        TerritoryValidationResponse response = territoryValidationService.validate(
                new TerritoryValidationRequest(cityId, null, null, null, null));
        assertFalse(response.valid());
        assertEquals("CITY_NOT_FOUND", response.reasonCode());
    }

    @Test
    void rejectsInactiveCity() {
        activeCity.setIsActive(false);
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(activeCity));
        TerritoryValidationResponse response = territoryValidationService.validate(
                new TerritoryValidationRequest(cityId, null, null, null, null));
        assertFalse(response.valid());
        assertEquals("CITY_INACTIVE", response.reasonCode());
    }

    @Test
    void rejectsUnknownZone() {
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(activeCity));
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.empty());
        TerritoryValidationResponse response = territoryValidationService.validate(
                new TerritoryValidationRequest(cityId, zoneId, null, null, null));
        assertFalse(response.valid());
        assertEquals("ZONE_NOT_FOUND", response.reasonCode());
    }

    @Test
    void rejectsZoneBelongingToDifferentCity() {
        City otherCity = new City();
        otherCity.setId(UUID.randomUUID());
        activeZone.setCity(otherCity);
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(activeCity));
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(activeZone));
        TerritoryValidationResponse response = territoryValidationService.validate(
                new TerritoryValidationRequest(cityId, zoneId, null, null, null));
        assertFalse(response.valid());
        assertEquals("ZONE_CITY_MISMATCH", response.reasonCode());
    }

    @Test
    void rejectsInactiveZone() {
        activeZone.setIsActive(false);
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(activeCity));
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(activeZone));
        TerritoryValidationResponse response = territoryValidationService.validate(
                new TerritoryValidationRequest(cityId, zoneId, null, null, null));
        assertFalse(response.valid());
        assertEquals("ZONE_INACTIVE", response.reasonCode());
    }

    @Test
    void acceptsActiveCityWithoutZone() {
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(activeCity));
        TerritoryValidationResponse response = territoryValidationService.validate(
                new TerritoryValidationRequest(cityId, null, "560001", null, null));
        assertTrue(response.valid());
        assertNull(response.reasonCode());
    }

    @Test
    void acceptsActiveCityAndMatchingActiveZone() {
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(activeCity));
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(activeZone));
        TerritoryValidationResponse response = territoryValidationService.validate(
                new TerritoryValidationRequest(cityId, zoneId, "560001", null, null));
        assertTrue(response.valid());
        assertNull(response.reasonCode());
    }
}
