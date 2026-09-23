package com.example.lbos.service;

import com.example.lbos.repository.FleetOwnerRepository;
import com.example.lbos.dto.FleetOwnerDTO;
import com.example.lbos.entity.FleetOwner;
import com.example.lbos.exception.FleetOwnerNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FleetOwnerServiceImplTest {

    @Mock
    private FleetOwnerRepository repository;

    @InjectMocks
    private FleetOwnerServiceImpl service;

    private FleetOwner entity;
    private FleetOwnerDTO dto;
    private final UUID id = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        entity = new FleetOwner();
        entity.setFleetOwnerId(id);
        entity.setUserAccountId(UUID.randomUUID());
        entity.setCityId(UUID.randomUUID());
        entity.setBusinessName("ABC Logistics");
        entity.setProfileStatus("VERIFIED");
        entity.setOwnerStatus("ACTIVE");

        dto = new FleetOwnerDTO();
        dto.setUserAccountId(entity.getUserAccountId());
        dto.setCityId(entity.getCityId());
        dto.setBusinessName("ABC Logistics");
        dto.setProfileStatus("VERIFIED");
        dto.setOwnerStatus("ACTIVE");
    }

    @Test
    void createTest() {
        when(repository.save(any(FleetOwner.class))).thenReturn(entity);
        FleetOwnerDTO result = service.createFleetOwner(dto);
        assertNotNull(result);
        verify(repository, times(1)).save(any(FleetOwner.class));
    }

    @Test
    void getByIdTest() {
        when(repository.findById(id)).thenReturn(Optional.of(entity));
        FleetOwnerDTO result = service.getFleetOwnerById(id);
        assertNotNull(result);
    }

    @Test
    void getByIdNotFoundTest() {
        when(repository.findById(id)).thenReturn(Optional.empty());
        assertThrows(FleetOwnerNotFoundException.class, () -> service.getFleetOwnerById(id));
    }

    @Test
    void getByUserAccountIdTest() {
        when(repository.findByUserAccountId(entity.getUserAccountId())).thenReturn(Optional.of(entity));

        FleetOwnerDTO result = service.getFleetOwnerByUserAccountId(entity.getUserAccountId());

        assertNotNull(result);
        assertEquals(id, result.getFleetOwnerId());
    }

    @Test
    void getByUserAccountIdNotFoundTest() {
        UUID unknownUserAccountId = UUID.randomUUID();
        when(repository.findByUserAccountId(unknownUserAccountId)).thenReturn(Optional.empty());

        assertThrows(FleetOwnerNotFoundException.class, () -> service.getFleetOwnerByUserAccountId(unknownUserAccountId));
    }

    @Test
    void getAllTest() {
        when(repository.findAll()).thenReturn(Arrays.asList(entity));
        List<FleetOwnerDTO> result = service.getAllFleetOwners();
        assertEquals(1, result.size());
    }

    @Test
    void updateTest() {
        when(repository.findById(id)).thenReturn(Optional.of(entity));
        when(repository.save(any(FleetOwner.class))).thenReturn(entity);
        FleetOwnerDTO result = service.updateFleetOwner(id, dto);
        assertNotNull(result);
    }

    @Test
    void deleteTest() {
        when(repository.existsById(id)).thenReturn(true);
        doNothing().when(repository).deleteById(id);
        service.deleteFleetOwner(id);
        verify(repository, times(1)).deleteById(id);
    }

    @Test
    void deleteNotFoundTest() {
        when(repository.existsById(id)).thenReturn(false);
        assertThrows(FleetOwnerNotFoundException.class, () -> service.deleteFleetOwner(id));
    }

    @Test
    void getByCityIdTest() {
        when(repository.findByCityId(any(UUID.class))).thenReturn(Arrays.asList(entity));
        List<FleetOwnerDTO> result = service.getFleetOwnersByCityId(UUID.randomUUID());
        assertFalse(result.isEmpty());
    }

    @Test
    void getByStatusTest() {
        when(repository.findByOwnerStatus("ACTIVE")).thenReturn(Arrays.asList(entity));
        List<FleetOwnerDTO> result = service.getFleetOwnersByStatus("ACTIVE");
        assertFalse(result.isEmpty());
    }

    @Test
    void searchTest() {
        when(repository.findByBusinessNameContainingIgnoreCase("ABC")).thenReturn(Arrays.asList(entity));
        List<FleetOwnerDTO> result = service.searchFleetOwnersByBusinessName("ABC");
        assertFalse(result.isEmpty());
    }
}
