package com.cbg.lbos.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.cbg.lbos.dto.StateDto;
import com.cbg.lbos.entity.State;
import com.cbg.lbos.exception.DuplicateResourceException;
import com.cbg.lbos.exception.ResourceNotFoundException;
import com.cbg.lbos.exception.ValidationException;
import com.cbg.lbos.repository.StateRepository;

@Service
@Transactional
public class StateService {
    private final StateRepository stateRepository;

    public StateService(StateRepository stateRepository) {
        this.stateRepository = stateRepository;
    }

    public StateDto createState(StateDto stateDto) {
        validateState(stateDto);
        String stateName = normalizeStateName(stateDto.getStateName());
        String countryCode = normalizeCountryCode(stateDto.getCountryCode());

        if (stateRepository.existsByStateNameIgnoreCaseAndCountryCodeIgnoreCase(stateName, countryCode)) {
            throw new DuplicateResourceException("State already exists for this country");
        }

        State state = new State();
        state.setStateName(stateName);
        state.setCountryCode(countryCode);
        state.setIsActive(stateDto.getIsActive() == null ? Boolean.TRUE : stateDto.getIsActive());
        return convertToDto(stateRepository.save(state));
    }

    @Transactional(readOnly = true)
    public List<StateDto> getAllStates() {
        return stateRepository.findAll().stream().map(this::convertToDto).toList();
    }

    @Transactional(readOnly = true)
    public StateDto getStateById(UUID id) {
        return convertToDto(findStateById(id));
    }

    @Transactional(readOnly = true)
    public List<StateDto> getStatesByCountryCode(String countryCode) {
        if (countryCode == null || countryCode.isBlank()) {
            throw new ValidationException("Country code must not be empty");
        }
        String normalizedCountryCode = normalizeCountryCode(countryCode);
        return stateRepository.findByCountryCodeIgnoreCase(normalizedCountryCode)
                .stream().map(this::convertToDto).toList();
    }

    @Transactional(readOnly = true)
    public List<StateDto> getStatesByActiveStatus(Boolean isActive) {
        if (isActive == null) {
            throw new ValidationException("Active status must not be null");
        }
        return stateRepository.findByIsActive(isActive).stream().map(this::convertToDto).toList();
    }

    public StateDto updateState(UUID id, StateDto stateDto) {
        validateState(stateDto);
        State existingState = findStateById(id);
        String stateName = normalizeStateName(stateDto.getStateName());
        String countryCode = normalizeCountryCode(stateDto.getCountryCode());

        boolean identityChanged = !existingState.getStateName().equalsIgnoreCase(stateName)
                || !existingState.getCountryCode().equalsIgnoreCase(countryCode);
        if (identityChanged && stateRepository.existsByStateNameIgnoreCaseAndCountryCodeIgnoreCase(stateName, countryCode)) {
            throw new DuplicateResourceException("State already exists for this country");
        }

        existingState.setStateName(stateName);
        existingState.setCountryCode(countryCode);
        if (stateDto.getIsActive() != null) {
            existingState.setIsActive(stateDto.getIsActive());
        }
        return convertToDto(stateRepository.save(existingState));
    }

    public void deleteState(UUID id) {
        State state = findStateById(id);
        stateRepository.delete(state);
    }

    private State findStateById(UUID id) {
        if (id == null) {
            throw new ValidationException("State ID must not be null");
        }
        return stateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("State not found with ID: " + id));
    }

    private void validateState(StateDto stateDto) {
        if (stateDto == null) {
            throw new ValidationException("State request must not be empty");
        }
        if (stateDto.getStateName() == null || stateDto.getStateName().isBlank()) {
            throw new ValidationException("State name must not be empty");
        }
        if (stateDto.getStateName().trim().length() > 100) {
            throw new ValidationException("State name must not exceed 100 characters");
        }
        if (stateDto.getCountryCode() == null || stateDto.getCountryCode().isBlank()) {
            throw new ValidationException("Country code must not be empty");
        }
        if (!stateDto.getCountryCode().trim().matches("^[A-Za-z]{2,10}$")) {
            throw new ValidationException("Country code must contain 2 to 10 letters");
        }
    }

    private String normalizeStateName(String stateName) {
        return stateName.trim().replaceAll("\\s+", " ");
    }

    private String normalizeCountryCode(String countryCode) {
        String normalized = countryCode.trim().toUpperCase();
        if (!normalized.matches("^[A-Z]{2}$")) {
            throw new ValidationException("Country code must be a 2-letter ISO 3166-1 alpha-2 code");
        }
        return normalized;
    }

    private StateDto convertToDto(State state) {
        return new StateDto(state.getId(), state.getStateName(), state.getCountryCode(), state.getIsActive());
    }
}
