package com.lbos.commercecustomer.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lbos.commercecustomer.client.PlatformTerritoryClient;
import com.lbos.commercecustomer.dto.client.platform.CityLookupResponse;
import com.lbos.commercecustomer.dto.client.platform.ZoneLookupResponse;
import com.lbos.commercecustomer.entity.CustomerAddress;
import com.lbos.commercecustomer.entity.CustomerProfile;
import com.lbos.commercecustomer.mapper.CommerceMapper;
import com.lbos.commercecustomer.repository.CustomerAddressRepository;
import com.lbos.commercecustomer.repository.CustomerCartItemRepository;
import com.lbos.commercecustomer.service.impl.AddressServiceImpl;
import com.lbos.commercecustomer.service.impl.ContextSupport;
import com.lbos.commercecustomer.service.impl.FeignCallSupport;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Listing addresses (every open of the header's address menu) must not ask S1 for the city / zone names every time. */
class AddressTerritoryNameCacheTest {

    private final UUID cityId = UUID.randomUUID();
    private final UUID zoneId = UUID.randomUUID();
    private final CustomerAddressRepository repo = mock(CustomerAddressRepository.class);
    private final PlatformTerritoryClient platform = mock(PlatformTerritoryClient.class);
    private final CustomerProfile customer = new CustomerProfile();
    private AddressServiceImpl service;

    private void setUp() {
        ContextSupport ctx = mock(ContextSupport.class);
        customer.setId(UUID.randomUUID());
        when(ctx.customer()).thenReturn(customer);
        CustomerAddress address = new CustomerAddress();
        address.setId(UUID.randomUUID());
        address.setCustomer(customer);
        address.setCityId(cityId);
        address.setZoneId(zoneId);
        when(repo.findByCustomerIdOrderByIdAsc(customer.getId())).thenReturn(List.of(address));
        when(platform.cities(null)).thenReturn(List.of(new CityLookupResponse(cityId, "Chennai", UUID.randomUUID(), "Tamil Nadu")));
        when(platform.zonesByCities(List.of(cityId))).thenReturn(List.of(new ZoneLookupResponse(zoneId, "North", cityId)));
        service = new AddressServiceImpl(repo, ctx, platform, new CommerceMapper(), new FeignCallSupport(), mock(CustomerCartItemRepository.class));
    }

    @Test
    void theNamesAreReadFromS1OnceAndReusedByLaterListings() {
        setUp();

        var first = service.list(0, 20);
        var second = service.list(0, 20);
        var third = service.list(0, 20);

        assertEquals("Chennai", first.items().get(0).cityName());
        assertEquals("North", first.items().get(0).zoneName());
        assertEquals("North", third.items().get(0).zoneName());
        assertEquals(second.items().size(), 1);
        verify(platform, times(1)).cities(null);
        verify(platform, times(1)).zonesByCities(List.of(cityId));
    }

    @Test
    void anAnswerS1CouldNotGiveIsNotRemembered() {
        setUp();
        when(platform.cities(null)).thenReturn(null, List.of(new CityLookupResponse(cityId, "Chennai", UUID.randomUUID(), "Tamil Nadu")));

        service.list(0, 20);
        var retried = service.list(0, 20);

        assertEquals("Chennai", retried.items().get(0).cityName());
        verify(platform, times(2)).cities(null);
    }

    /**
     * A customer with saved addresses in several different cities must still cost only ONE zone
     * lookup call, not one per distinct city - the exact N-sequential-Feign-calls pattern a live
     * network trace measured as 136ms (2 cities) vs 19ms (1 city) before zonesByCities() existed.
     */
    @Test
    void severalCitiesStillCostOneZoneLookupCall() {
        ContextSupport ctx = mock(ContextSupport.class);
        customer.setId(UUID.randomUUID());
        when(ctx.customer()).thenReturn(customer);
        UUID secondCityId = UUID.randomUUID();
        UUID secondZoneId = UUID.randomUUID();
        CustomerAddress first = new CustomerAddress();
        first.setId(UUID.randomUUID());
        first.setCustomer(customer);
        first.setCityId(cityId);
        first.setZoneId(zoneId);
        CustomerAddress second = new CustomerAddress();
        second.setId(UUID.randomUUID());
        second.setCustomer(customer);
        second.setCityId(secondCityId);
        second.setZoneId(secondZoneId);
        when(repo.findByCustomerIdOrderByIdAsc(customer.getId())).thenReturn(List.of(first, second));
        when(platform.cities(null)).thenReturn(List.of(
                new CityLookupResponse(cityId, "Chennai", UUID.randomUUID(), "Tamil Nadu"),
                new CityLookupResponse(secondCityId, "Bengaluru", UUID.randomUUID(), "Karnataka")));
        // Stubbed with any(): the two cityIds come from iterating a Set, whose order is not
        // guaranteed - the response is keyed by each ZoneLookupResponse's own cityId regardless.
        when(platform.zonesByCities(any())).thenReturn(List.of(
                new ZoneLookupResponse(zoneId, "North", cityId),
                new ZoneLookupResponse(secondZoneId, "West", secondCityId)));
        service = new AddressServiceImpl(repo, ctx, platform, new CommerceMapper(), new FeignCallSupport(), mock(CustomerCartItemRepository.class));

        var page = service.list(0, 20);

        assertEquals("North", page.items().stream().filter(a -> a.cityName().equals("Chennai")).findFirst().orElseThrow().zoneName());
        assertEquals("West", page.items().stream().filter(a -> a.cityName().equals("Bengaluru")).findFirst().orElseThrow().zoneName());
        verify(platform, times(1)).zonesByCities(any());
    }
}
