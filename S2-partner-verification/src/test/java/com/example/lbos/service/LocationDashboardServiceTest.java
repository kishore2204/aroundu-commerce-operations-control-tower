package com.example.lbos.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.example.lbos.client.AccountLookupClient;
import com.example.lbos.client.S3CommerceClient;
import com.example.lbos.client.S4OrderClient;
import com.example.lbos.client.S5FleetClient;
import com.example.lbos.entity.FleetOwner;
import com.example.lbos.exception.FleetOwnerNotFoundException;
import com.example.lbos.exception.RetailerNotFoundException;
import com.example.lbos.repository.FleetOwnerRepository;
import com.example.lbos.repository.RetailerRepository;
import com.example.lbos.repository.VerificationQueueRepository;
import com.example.lbos.security.ZoneScope;

/** The Location Manager dashboard's per-partner detail: zone-scoped, and one downstream failure must not blank the rest. */
@ExtendWith(MockitoExtension.class)
class LocationDashboardServiceTest {
    @Mock private VerificationQueueRepository queues;
    @Mock private RetailerRepository retailers;
    @Mock private FleetOwnerRepository fleetOwners;
    @Mock private ZoneScope zoneScope;
    @Mock private AccountLookupClient accounts;
    @Mock private S3CommerceClient commerce;
    @Mock private S4OrderClient orders;
    @Mock private S5FleetClient fleet;
    @InjectMocks private LocationDashboardService service;

    @Test
    void aFleetOwnerOutsideTheCallersZoneIsRefusedBeforeAnythingIsRead() {
        UUID id = UUID.randomUUID();
        UUID otherZone = UUID.randomUUID();
        FleetOwner owner = new FleetOwner();
        owner.setZoneId(otherZone);
        when(fleetOwners.findById(id)).thenReturn(Optional.of(owner));
        doThrow(new SecurityException("outside your zone")).when(zoneScope).requireZone(otherZone);

        assertThrows(SecurityException.class, () -> service.fleetAssets(id));
    }

    @Test
    void whenTheDriverListCannotBeReadTheVehiclesAreStillReturned() {
        UUID id = UUID.randomUUID();
        FleetOwner owner = new FleetOwner();
        owner.setZoneId(UUID.randomUUID());
        when(fleetOwners.findById(id)).thenReturn(Optional.of(owner));
        when(fleet.driversOf(id)).thenThrow(new RuntimeException("S5 unreachable"));

        var assets = service.fleetAssets(id);

        assertEquals(0, assets.drivers().size());
        verify(fleet).vehiclesOf(id);
    }

    @Test
    void anUnknownFleetOwnerOrRetailerIsNotFound() {
        UUID id = UUID.randomUUID();
        when(fleetOwners.findById(id)).thenReturn(Optional.empty());
        when(retailers.findById(id)).thenReturn(Optional.empty());

        assertThrows(FleetOwnerNotFoundException.class, () -> service.fleetAssets(id));
        assertThrows(RetailerNotFoundException.class, () -> service.retailerReviews(id, 0, 10));
    }
}
