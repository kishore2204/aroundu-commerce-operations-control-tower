package com.cbg.lbos.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import com.cbg.lbos.client.S2PartnerClient;
import com.cbg.lbos.entity.AssignmentStatus;
import com.cbg.lbos.entity.LocationManager;
import com.cbg.lbos.repository.LocationManagerAssignmentHistoryRepository;
import com.cbg.lbos.repository.LocationManagerRepository;
import com.cbg.lbos.repository.OperationsManagerRepository;
import com.cbg.lbos.repository.UserAccountRepository;
import com.cbg.lbos.repository.ZoneRepository;

/** The Operations Manager's Location Managers page filters by name, zone and status - the name part is applied by the server. */
@ExtendWith(MockitoExtension.class)
class LocationManagerNameFilterTest {
    @Mock LocationManagerRepository locationManagerRepository;
    @Mock UserAccountRepository userAccountRepository;
    @Mock ZoneRepository zoneRepository;
    @Mock OperationsManagerRepository operationsManagerRepository;
    @Mock S2PartnerClient s2PartnerClient;
    @Mock LocationManagerAssignmentHistoryRepository historyRepository;
    @Mock UserAccountService userAccountService;

    private LocationManagerServiceImpl service;
    private final Pageable pageable = PageRequest.of(0, 20);
    private final UUID zoneId = UUID.randomUUID();
    private final UUID operationsManagerId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new LocationManagerServiceImpl(locationManagerRepository, userAccountRepository, zoneRepository,
                operationsManagerRepository, s2PartnerClient, userAccountService, historyRepository, null);
    }

    @Test
    void aNameIsSearchedCaseInsensitivelyAsAContainsPatternTogetherWithZoneAndStatus() {
        when(locationManagerRepository.searchByName(zoneId, operationsManagerId, AssignmentStatus.INACTIVE, "%karthik%", pageable))
                .thenReturn(Page.<LocationManager>empty());

        service.getLocationManagers(zoneId, operationsManagerId, AssignmentStatus.INACTIVE, "  KarThik ", pageable);

        verify(locationManagerRepository).searchByName(zoneId, operationsManagerId, AssignmentStatus.INACTIVE, "%karthik%", pageable);
        verify(locationManagerRepository, never()).search(any(), any(), any(), any());
    }

    @Test
    void aBlankNameFallsBackToTheUnfilteredSearch() {
        when(locationManagerRepository.search(zoneId, operationsManagerId, null, pageable)).thenReturn(Page.<LocationManager>empty());

        service.getLocationManagers(zoneId, operationsManagerId, null, "   ", pageable);

        verify(locationManagerRepository).search(zoneId, operationsManagerId, null, pageable);
        verify(locationManagerRepository, never()).searchByName(any(), any(), any(), any(), any());
    }
}
