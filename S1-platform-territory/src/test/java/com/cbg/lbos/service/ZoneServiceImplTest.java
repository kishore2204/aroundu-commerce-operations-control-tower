package com.cbg.lbos.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.cbg.lbos.dto.ZoneDto;
import com.cbg.lbos.entity.AssignmentStatus;
import com.cbg.lbos.entity.City;
import com.cbg.lbos.entity.State;
import com.cbg.lbos.entity.Zone;
import com.cbg.lbos.exception.DuplicateResourceException;
import com.cbg.lbos.exception.InvalidAssignmentException;
import com.cbg.lbos.exception.ResourceNotFoundException;
import com.cbg.lbos.repository.CityRepository;
import com.cbg.lbos.repository.LocationManagerRepository;
import com.cbg.lbos.repository.ZoneRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class ZoneServiceImplTest {
    @Mock ZoneRepository zoneRepository;
    @Mock CityRepository cityRepository;
    @Mock LocationManagerRepository locationManagerRepository;
    private ZoneServiceImpl zoneService;
    private UUID cityId;
    private UUID stateId;
    private UUID zoneId;
    private City city;
    private State state;
    private Zone zone;

    @BeforeEach
    void setUp() {
        zoneService = new ZoneServiceImpl(zoneRepository, cityRepository, locationManagerRepository);
        cityId = UUID.randomUUID();
        stateId = UUID.randomUUID();
        zoneId = UUID.randomUUID();
        state = new State();
        org.springframework.test.util.ReflectionTestUtils.setField(state, "id", stateId);
        state.setStateName("Tamil Nadu");
        state.setCountryCode("IN");
        city = new City();
        city.setId(cityId);
        city.setCityName("Chennai");
        city.setState(state);
        city.setIsActive(true);
        zone = new Zone();
        org.springframework.test.util.ReflectionTestUtils.setField(zone, "id", zoneId);
        zone.setCity(city);
        zone.setZoneName("North Zone");
        zone.setIsActive(true);
    }

    private ZoneDto request(UUID requestedCityId, String zoneName) {
        ZoneDto dto = new ZoneDto();
        dto.setCityId(requestedCityId);
        dto.setZoneName(zoneName);
        return dto;
    }

    @Test
    void createZoneNormalizesNameAndCreatesActiveZone() {
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(city));
        when(zoneRepository.existsByCityIdAndZoneNameIgnoreCase(cityId, "North Zone")).thenReturn(false);
        when(zoneRepository.save(any(Zone.class))).thenAnswer(invocation -> {
            Zone saved = invocation.getArgument(0);
            org.springframework.test.util.ReflectionTestUtils.setField(saved, "id", zoneId);
            return saved;
        });

        ZoneDto result = zoneService.createZone(request(cityId, "  North   Zone  "));

        assertEquals(zoneId, result.getZoneId());
        assertEquals("North Zone", result.getZoneName());
        assertTrue(result.getActive());
        assertEquals(cityId, result.getCityId());
        verify(zoneRepository).save(any(Zone.class));
    }

    @Test
    void createZoneRejectsInactiveCity() {
        city.setIsActive(false);
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(city));

        assertThrows(InvalidAssignmentException.class,
                () -> zoneService.createZone(request(cityId, "North Zone")));
        verify(zoneRepository, never()).save(any());
    }

    @Test
    void createZoneRejectsDuplicateName() {
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(city));
        when(zoneRepository.existsByCityIdAndZoneNameIgnoreCase(cityId, "North Zone")).thenReturn(true);

        assertThrows(DuplicateResourceException.class,
                () -> zoneService.createZone(request(cityId, "North Zone")));
    }

    @Test
    void getZoneByIdReturnsMappedDto() {
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));

        ZoneDto result = zoneService.getZoneById(zoneId);

        assertEquals(zoneId, result.getZoneId());
        assertEquals("North Zone", result.getZoneName());
        assertEquals(cityId, result.getCityId());
        assertEquals("Chennai", result.getCityName());
        assertEquals(stateId, result.getStateId());
        assertEquals("Tamil Nadu", result.getStateName());
    }

    @Test
    void getZoneByIdThrowsWhenMissing() {
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> zoneService.getZoneById(zoneId));
    }

    @Test
    void getZonesValidatesCityWhenCityIdProvided() {
        Pageable pageable = PageRequest.of(0, 10);
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(city));
        when(zoneRepository.search(cityId, true, pageable)).thenReturn(new PageImpl<>(List.of(zone)));

        Page<ZoneDto> result = zoneService.getZones(cityId, true, pageable);

        assertEquals(1, result.getContent().size());
        verify(cityRepository).findById(cityId);
        verify(zoneRepository).search(cityId, true, pageable);
    }

    @Test
    void getZonesWithoutCityDoesNotLookupCity() {
        Pageable pageable = PageRequest.of(0, 10);
        when(zoneRepository.search(null, null, pageable)).thenReturn(new PageImpl<>(List.of(zone)));

        Page<ZoneDto> result = zoneService.getZones(null, null, pageable);

        assertEquals(1, result.getTotalElements());
        verifyNoInteractions(cityRepository);
    }

    @Test
    void updateZoneNormalizesNameAndExcludesCurrentZoneFromDuplicateCheck() {
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(zoneRepository.existsByCityIdAndZoneNameIgnoreCaseAndIdNot(cityId, "South Zone", zoneId)).thenReturn(false);
        when(zoneRepository.save(zone)).thenReturn(zone);

        ZoneDto result = zoneService.updateZone(zoneId, request(cityId, " South   Zone "));

        assertEquals("South Zone", result.getZoneName());
        verify(zoneRepository).existsByCityIdAndZoneNameIgnoreCaseAndIdNot(cityId, "South Zone", zoneId);
    }

    @Test
    void updateZoneRejectsDuplicate() {
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(zoneRepository.existsByCityIdAndZoneNameIgnoreCaseAndIdNot(cityId, "South Zone", zoneId)).thenReturn(true);

        assertThrows(DuplicateResourceException.class,
                () -> zoneService.updateZone(zoneId, request(cityId, "South Zone")));
    }

    @Test
    void activateZoneRequiresActiveCity() {
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(zoneRepository.save(zone)).thenReturn(zone);

        ZoneDto result = zoneService.activateZone(zoneId);

        assertTrue(result.getActive());
        verify(zoneRepository).save(zone);
    }

    @Test
    void activateZoneRejectsInactiveCity() {
        city.setIsActive(false);
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));

        assertThrows(InvalidAssignmentException.class, () -> zoneService.activateZone(zoneId));
        verify(zoneRepository, never()).save(any());
    }

    @Test
    void deactivateZoneRejectsActiveLocationManager() {
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(locationManagerRepository.existsByZoneIdAndAssignmentStatus(zoneId, AssignmentStatus.ACTIVE)).thenReturn(true);

        assertThrows(InvalidAssignmentException.class, () -> zoneService.deactivateZone(zoneId));
        verify(zoneRepository, never()).save(any());
    }

    @Test
    void deactivateZoneSucceedsWhenNoActiveLocationManager() {
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(locationManagerRepository.existsByZoneIdAndAssignmentStatus(zoneId, AssignmentStatus.ACTIVE)).thenReturn(false);
        when(zoneRepository.save(zone)).thenReturn(zone);

        ZoneDto result = zoneService.deactivateZone(zoneId);

        assertFalse(result.getActive());
        verify(zoneRepository).save(zone);
    }
}
