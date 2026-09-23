package com.cbg.lbos.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import com.cbg.lbos.dto.CityDtos.CreateRequest;
import com.cbg.lbos.dto.CityDtos.Response;
import com.cbg.lbos.dto.CityDtos.UpdateRequest;
import com.cbg.lbos.entity.City;
import com.cbg.lbos.entity.State;
import com.cbg.lbos.exception.DuplicateResourceException;
import com.cbg.lbos.exception.InvalidAssignmentException;
import com.cbg.lbos.exception.ResourceNotFoundException;
import com.cbg.lbos.exception.ValidationException;
import com.cbg.lbos.repository.CityRepository;
import com.cbg.lbos.repository.StateRepository;

@ExtendWith(MockitoExtension.class)
class CityServiceTest {
    @Mock private CityRepository cityRepository;
    @Mock private StateRepository stateRepository;

    private CityService cityService;
    private UUID cityId;
    private UUID stateId;
    private State state;
    private City city;

    @BeforeEach
    void setUp() {
        cityService = new CityService(cityRepository, stateRepository);
        cityId = UUID.randomUUID();
        stateId = UUID.randomUUID();

        state = new State();
        state.setStateName("Tamil Nadu");
        state.setCountryCode("IN");
        state.setIsActive(true);
        org.springframework.test.util.ReflectionTestUtils.setField(state, "id", stateId);

        city = new City();
        city.setId(cityId);
        city.setState(state);
        city.setCityName("Chennai");
        city.setIsActive(true);
    }

    @Test
    void listWithoutFilterUsesFindAll() {
        Pageable pageable = PageRequest.of(0, 10);
        when(cityRepository.findAll(pageable)).thenReturn(new PageImpl<>(List.of(city)));

        Page<Response> result = cityService.list(null, pageable);

        assertEquals(1, result.getTotalElements());
        assertEquals("Chennai", result.getContent().get(0).cityName());
        verify(cityRepository).findAll(pageable);
        verify(cityRepository, never()).findByIsActive(any(), any());
    }

    @Test
    void listWithFilterUsesFilteredQuery() {
        Pageable pageable = PageRequest.of(0, 10);
        when(cityRepository.findByIsActive(false, pageable)).thenReturn(new PageImpl<>(List.of(city)));

        Page<Response> result = cityService.list(false, pageable);

        assertEquals(1, result.getTotalElements());
        verify(cityRepository).findByIsActive(false, pageable);
    }

    @Test
    void getReturnsCity() {
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(city));

        Response result = cityService.get(cityId);

        assertEquals(cityId, result.id());
        assertEquals(stateId, result.stateId());
        assertEquals("Tamil Nadu", result.stateName());
    }

    @Test
    void getRejectsNullId() {
        assertThrows(ValidationException.class, () -> cityService.get(null));
        verifyNoInteractions(cityRepository);
    }

    @Test
    void getThrowsWhenMissing() {
        when(cityRepository.findById(cityId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> cityService.get(cityId));
    }

    @Test
    void createNormalizesNameAndCreatesActiveCity() {
        when(stateRepository.findById(stateId)).thenReturn(Optional.of(state));
        when(cityRepository.existsByStateIdAndCityNameIgnoreCase(stateId, "New Chennai")).thenReturn(false);
        when(cityRepository.save(any(City.class))).thenAnswer(invocation -> {
            City savedCity = invocation.getArgument(0);
            savedCity.setId(cityId);
            return savedCity;
        });

        Response result = cityService.create(new CreateRequest(stateId, "  New   Chennai  "));

        assertEquals(cityId, result.id());
        assertEquals("New Chennai", result.cityName());
        assertTrue(result.active());
        verify(cityRepository).save(any(City.class));
    }

    @Test
    void createRejectsNullRequest() {
        assertThrows(ValidationException.class, () -> cityService.create(null));
        verifyNoInteractions(stateRepository, cityRepository);
    }

    @Test
    void createRejectsInactiveState() {
        state.setIsActive(false);
        when(stateRepository.findById(stateId)).thenReturn(Optional.of(state));

        assertThrows(InvalidAssignmentException.class,
                () -> cityService.create(new CreateRequest(stateId, "Chennai")));
        verify(cityRepository, never()).save(any());
    }

    @Test
    void createRejectsDuplicateCityWithinState() {
        when(stateRepository.findById(stateId)).thenReturn(Optional.of(state));
        when(cityRepository.existsByStateIdAndCityNameIgnoreCase(stateId, "Chennai")).thenReturn(true);

        assertThrows(DuplicateResourceException.class,
                () -> cityService.create(new CreateRequest(stateId, "Chennai")));
        verify(cityRepository, never()).save(any());
    }

    @Test
    void updateChangesStateAndName() {
        UUID newStateId = UUID.randomUUID();
        State newState = new State();
        org.springframework.test.util.ReflectionTestUtils.setField(newState, "id", newStateId);
        newState.setStateName("Karnataka");
        newState.setCountryCode("IN");
        newState.setIsActive(true);

        when(cityRepository.findById(cityId)).thenReturn(Optional.of(city));
        when(stateRepository.findById(newStateId)).thenReturn(Optional.of(newState));
        when(cityRepository.existsByStateIdAndCityNameIgnoreCaseAndIdNot(newStateId, "Bengaluru", cityId)).thenReturn(false);
        when(cityRepository.save(city)).thenReturn(city);

        Response result = cityService.update(cityId, new UpdateRequest(newStateId, " Bengaluru ", true));

        assertEquals("Bengaluru", result.cityName());
        assertEquals(newStateId, result.stateId());
        assertTrue(result.active());
        verify(cityRepository).save(city);
    }

    @Test
    void updateRejectsDuplicateCity() {
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(city));
        when(stateRepository.findById(stateId)).thenReturn(Optional.of(state));
        when(cityRepository.existsByStateIdAndCityNameIgnoreCaseAndIdNot(stateId, "Chennai", cityId)).thenReturn(true);

        assertThrows(DuplicateResourceException.class,
                () -> cityService.update(cityId, new UpdateRequest(stateId, "Chennai", true)));
        verify(cityRepository, never()).save(any());
    }

    @Test
    void updateRejectsInactiveState() {
        state.setIsActive(false);
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(city));
        when(stateRepository.findById(stateId)).thenReturn(Optional.of(state));

        assertThrows(InvalidAssignmentException.class,
                () -> cityService.update(cityId, new UpdateRequest(stateId, "Chennai", true)));
        verify(cityRepository, never()).save(any());
    }

    @Test
    void deleteSoftDeletesCity() {
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(city));
        when(cityRepository.save(city)).thenReturn(city);

        cityService.delete(cityId);

        assertFalse(city.getIsActive());
        verify(cityRepository).save(city);
    }

    @Test
    void activateRequiresActiveState() {
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(city));
        when(cityRepository.save(city)).thenReturn(city);
        city.setIsActive(false);

        Response result = cityService.activate(cityId);

        assertTrue(result.active());
        verify(cityRepository).save(city);
    }

    @Test
    void activateRejectsInactiveState() {
        state.setIsActive(false);
        city.setIsActive(false);
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(city));

        assertThrows(InvalidAssignmentException.class, () -> cityService.activate(cityId));
        verify(cityRepository, never()).save(any());
    }

    @Test
    void deactivateMarksCityInactive() {
        when(cityRepository.findById(cityId)).thenReturn(Optional.of(city));
        when(cityRepository.save(city)).thenReturn(city);

        Response result = cityService.deactivate(cityId);

        assertFalse(result.active());
        verify(cityRepository).save(city);
    }
}
