package com.cbg.lbos.service;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

@Service
@Transactional
public class CityService {
    private final CityRepository cityRepository;
    private final StateRepository stateRepository;

    public CityService(CityRepository cityRepository, StateRepository stateRepository) {
        this.cityRepository = cityRepository;
        this.stateRepository = stateRepository;
    }

    @Transactional(readOnly = true)
    public Page<Response> list(Boolean active, Pageable pageable) {
        Page<City> cities = active == null
                ? cityRepository.findAll(pageable)
                : cityRepository.findByIsActive(active, pageable);
        return cities.map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Response get(UUID cityId) {
        return toResponse(findCity(cityId));
    }

    public Response create(CreateRequest request) {
        validateCreateRequest(request);
        State state = findState(request.stateId());
        validateActiveState(state);

        String cityName = normalizeCityName(request.cityName());
        if (cityRepository.existsByStateIdAndCityNameIgnoreCase(state.getId(), cityName)) {
            throw new DuplicateResourceException("City already exists in this state");
        }

        City city = new City();
        city.setState(state);
        city.setCityName(cityName);
        city.setIsActive(true);
        return toResponse(cityRepository.save(city));
    }

    public Response update(UUID cityId, UpdateRequest request) {
        if (request == null) {
            throw new ValidationException("City request must not be empty");
        }
        if (request.stateId() == null) {
            throw new ValidationException("State ID is required");
        }
        if (request.cityName() == null || request.cityName().isBlank()) {
            throw new ValidationException("City name must not be empty");
        }

        City city = findCity(cityId);
        State state = findState(request.stateId());
        validateActiveState(state);
        String cityName = normalizeCityName(request.cityName());

        if (cityRepository.existsByStateIdAndCityNameIgnoreCaseAndIdNot(state.getId(), cityName, cityId)) {
            throw new DuplicateResourceException("City already exists in this state");
        }

        city.setState(state);
        city.setCityName(cityName);
        if (request.active() != null) {
            city.setIsActive(request.active());
        }
        return toResponse(cityRepository.save(city));
    }

    /** Soft-deletes a city by marking it inactive. */
    public void delete(UUID cityId) {
        City city = findCity(cityId);
        city.setIsActive(false);
        cityRepository.save(city);
    }

    public Response activate(UUID cityId) {
        City city = findCity(cityId);
        validateActiveState(city.getState());
        city.setIsActive(true);
        return toResponse(cityRepository.save(city));
    }

    public Response deactivate(UUID cityId) {
        City city = findCity(cityId);
        city.setIsActive(false);
        return toResponse(cityRepository.save(city));
    }

    private City findCity(UUID cityId) {
        if (cityId == null) {
            throw new ValidationException("City ID must not be null");
        }
        return cityRepository.findById(cityId)
                .orElseThrow(() -> new ResourceNotFoundException("City not found: " + cityId));
    }

    private State findState(UUID stateId) {
        return stateRepository.findById(stateId)
                .orElseThrow(() -> new ResourceNotFoundException("State not found: " + stateId));
    }

    private void validateActiveState(State state) {
        if (!Boolean.TRUE.equals(state.getIsActive())) {
            throw new InvalidAssignmentException("City cannot be assigned to an inactive State");
        }
    }

    private void validateCreateRequest(CreateRequest request) {
        if (request == null) {
            throw new ValidationException("City request must not be empty");
        }
        if (request.stateId() == null) {
            throw new ValidationException("State ID is required");
        }
        if (request.cityName() == null || request.cityName().isBlank()) {
            throw new ValidationException("City name must not be empty");
        }
    }

    private String normalizeCityName(String cityName) {
        return cityName.trim().replaceAll("\\s+", " ");
    }

    private Response toResponse(City city) {
        return new Response(
                city.getId(),
                city.getCityName(),
                city.getState().getId(),
                city.getState().getStateName(),
                city.getIsActive());
    }
}
