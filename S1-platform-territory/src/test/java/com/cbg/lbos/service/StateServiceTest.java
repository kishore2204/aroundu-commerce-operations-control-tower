package com.cbg.lbos.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.cbg.lbos.dto.StateDto;
import com.cbg.lbos.entity.State;
import com.cbg.lbos.exception.DuplicateResourceException;
import com.cbg.lbos.exception.ResourceNotFoundException;
import com.cbg.lbos.exception.ValidationException;
import com.cbg.lbos.repository.StateRepository;

@ExtendWith(MockitoExtension.class)
class StateServiceTest {
    @Mock private StateRepository stateRepository;

    private StateService stateService;
    private UUID stateId;
    private State state;

    @BeforeEach
    void setUp() {
        stateService = new StateService(stateRepository);
        stateId = UUID.randomUUID();
        state = new State();
        org.springframework.test.util.ReflectionTestUtils.setField(state, "id", stateId);
        state.setStateName("Tamil Nadu");
        state.setCountryCode("IN");
        state.setIsActive(true);
    }

    @Test
    void createNormalizesAndDefaultsActive() {
        when(stateRepository.existsByStateNameIgnoreCaseAndCountryCodeIgnoreCase("Tamil Nadu", "IN")).thenReturn(false);
        when(stateRepository.save(any(State.class))).thenAnswer(invocation -> {
            State savedState = invocation.getArgument(0);
            savedState.setIsActive(true);
            org.springframework.test.util.ReflectionTestUtils.setField(savedState, "id", stateId);
            return savedState;
        });

        StateDto result = stateService.createState(new StateDto(null, " Tamil   Nadu ", " in ", null));

        assertEquals(stateId, result.getId());
        assertEquals("Tamil Nadu", result.getStateName());
        assertEquals("IN", result.getCountryCode());
        assertTrue(result.getIsActive());
    }

    @Test
    void createRejectsNullRequest() {
        assertThrows(ValidationException.class, () -> stateService.createState(null));
        verifyNoInteractions(stateRepository);
    }

    @Test
    void createRejectsDuplicate() {
        when(stateRepository.existsByStateNameIgnoreCaseAndCountryCodeIgnoreCase("Tamil Nadu", "IN")).thenReturn(true);

        assertThrows(DuplicateResourceException.class,
                () -> stateService.createState(new StateDto(null, "Tamil Nadu", "IN", true)));
        verify(stateRepository, never()).save(any());
    }

    @Test
    void createRejectsBlankName() {
        assertThrows(ValidationException.class,
                () -> stateService.createState(new StateDto(null, " ", "IN", true)));
    }

    @Test
    void createRejectsInvalidCountryCode() {
        assertThrows(ValidationException.class,
                () -> stateService.createState(new StateDto(null, "Tamil Nadu", "I1", true)));
    }

    @Test
    void getAllMapsStates() {
        when(stateRepository.findAll()).thenReturn(List.of(state));

        List<StateDto> result = stateService.getAllStates();

        assertEquals(1, result.size());
        assertEquals(stateId, result.get(0).getId());
    }

    @Test
    void getByIdReturnsState() {
        when(stateRepository.findById(stateId)).thenReturn(Optional.of(state));

        assertEquals(stateId, stateService.getStateById(stateId).getId());
    }

    @Test
    void getByIdRejectsNull() {
        assertThrows(ValidationException.class, () -> stateService.getStateById(null));
        verifyNoInteractions(stateRepository);
    }

    @Test
    void getByIdThrowsNotFound() {
        when(stateRepository.findById(stateId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> stateService.getStateById(stateId));
    }

    @Test
    void getByCountryNormalizesCode() {
        when(stateRepository.findByCountryCodeIgnoreCase("IN")).thenReturn(List.of(state));

        List<StateDto> result = stateService.getStatesByCountryCode(" in ");

        assertEquals(1, result.size());
        verify(stateRepository).findByCountryCodeIgnoreCase("IN");
    }

    @Test
    void getByCountryRejectsBlank() {
        assertThrows(ValidationException.class, () -> stateService.getStatesByCountryCode(" "));
    }

    @Test
    void getByCountryRejectsInvalidCode() {
        assertThrows(ValidationException.class, () -> stateService.getStatesByCountryCode("I1"));
    }

    @Test
    void getByActiveStatusUsesRepository() {
        when(stateRepository.findByIsActive(true)).thenReturn(List.of(state));

        assertEquals(1, stateService.getStatesByActiveStatus(true).size());
        verify(stateRepository).findByIsActive(true);
    }

    @Test
    void getByActiveStatusRejectsNull() {
        assertThrows(ValidationException.class, () -> stateService.getStatesByActiveStatus(null));
    }

    @Test
    void updateChangesState() {
        when(stateRepository.findById(stateId)).thenReturn(Optional.of(state));
        when(stateRepository.existsByStateNameIgnoreCaseAndCountryCodeIgnoreCase("Karnataka", "IN")).thenReturn(false);
        when(stateRepository.save(state)).thenReturn(state);

        StateDto result = stateService.updateState(stateId, new StateDto(null, " Karnataka ", " in ", false));

        assertEquals("Karnataka", result.getStateName());
        assertFalse(result.getIsActive());
    }

    @Test
    void updateRejectsDuplicateWhenIdentityChanges() {
        when(stateRepository.findById(stateId)).thenReturn(Optional.of(state));
        when(stateRepository.existsByStateNameIgnoreCaseAndCountryCodeIgnoreCase("Karnataka", "IN")).thenReturn(true);

        assertThrows(DuplicateResourceException.class,
                () -> stateService.updateState(stateId, new StateDto(null, "Karnataka", "IN", true)));
        verify(stateRepository, never()).save(any());
    }

    @Test
    void updateDoesNotCheckDuplicateWhenIdentityUnchanged() {
        when(stateRepository.findById(stateId)).thenReturn(Optional.of(state));
        when(stateRepository.save(state)).thenReturn(state);

        stateService.updateState(stateId, new StateDto(null, " Tamil Nadu ", " in ", false));

        verify(stateRepository, never()).existsByStateNameIgnoreCaseAndCountryCodeIgnoreCase(anyString(), anyString());
    }

    @Test
    void deleteDeletesExistingState() {
        when(stateRepository.findById(stateId)).thenReturn(Optional.of(state));

        stateService.deleteState(stateId);

        verify(stateRepository).delete(state);
    }
}
