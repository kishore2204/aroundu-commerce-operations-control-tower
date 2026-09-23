package com.example.lbos.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import com.example.lbos.dto.FleetOwnerDTO;
import com.example.lbos.dto.RetailerDTO;
import com.example.lbos.service.FleetOwnerService;
import com.example.lbos.service.RetailerService;

/**
 * GET /api/retailers/me and /api/fleet-owners/me resolve the caller's own profile by the JWT subject in ONE lookup - the screens
 * used to download every retailer / fleet owner and pick their own client-side.
 */
@ExtendWith(MockitoExtension.class)
class PartnerMeEndpointsTest {
    @Mock private RetailerService retailerService;
    @Mock private FleetOwnerService fleetOwnerService;
    @InjectMocks private RetailerController retailerController;
    @InjectMocks private FleetOwnerController fleetOwnerController;

    @Test
    void aRetailerIsResolvedFromTheirOwnTokenSubject() {
        UUID account = UUID.randomUUID();
        RetailerDTO mine = new RetailerDTO();
        mine.setUserAccountId(account);
        when(retailerService.getRetailerByUserAccountId(account)).thenReturn(mine);

        var response = retailerController.getMyRetailer(new UsernamePasswordAuthenticationToken(account.toString(), null));

        assertEquals(200, response.getStatusCode().value());
        assertEquals(account, response.getBody().getUserAccountId());
        verify(retailerService).getRetailerByUserAccountId(account);
    }

    @Test
    void aFleetOwnerIsResolvedFromTheirOwnTokenSubject() {
        UUID account = UUID.randomUUID();
        FleetOwnerDTO mine = new FleetOwnerDTO();
        mine.setUserAccountId(account);
        when(fleetOwnerService.getFleetOwnerByUserAccountId(account)).thenReturn(mine);

        var response = fleetOwnerController.getMyFleetOwner(new UsernamePasswordAuthenticationToken(account.toString(), null));

        assertEquals(200, response.getStatusCode().value());
        verify(fleetOwnerService).getFleetOwnerByUserAccountId(account);
    }
}
