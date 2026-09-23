package com.cbg.lbos.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.cbg.lbos.entity.City;
import com.cbg.lbos.entity.Zone;
import com.cbg.lbos.repository.CityRepository;
import com.cbg.lbos.repository.ZoneRepository;
import com.cbg.lbos.service.TerritoryValidationService;

/** The address list labels zones for every city of a customer's addresses with ONE call instead of one call per city. */
@ExtendWith(MockitoExtension.class)
class InternalTerritoryControllerZonesByCitiesTest {
    @Mock private TerritoryValidationService validation;
    @Mock private CityRepository cityRepository;
    @Mock private ZoneRepository zoneRepository;

    private Zone zone(UUID id, String name, UUID cityId) {
        Zone zone = new Zone();
        zone.setId(id);
        zone.setZoneName(name);
        City city = new City();
        city.setId(cityId);
        zone.setCity(city);
        return zone;
    }

    @Test
    void zonesOfSeveralCitiesComeBackFromOneRepositoryQuery() {
        UUID chennai = UUID.randomUUID();
        UUID bengaluru = UUID.randomUUID();
        when(zoneRepository.findByCity_IdInAndIsActiveTrue(List.of(chennai, bengaluru)))
                .thenReturn(List.of(zone(UUID.randomUUID(), "North", chennai), zone(UUID.randomUUID(), "West", bengaluru)));
        InternalTerritoryController controller = new InternalTerritoryController(validation, cityRepository, zoneRepository);

        var result = controller.zonesByCities(List.of(chennai, bengaluru));

        assertEquals(2, result.size());
        assertEquals(chennai, result.get(0).cityId());
        verify(zoneRepository, times(1)).findByCity_IdInAndIsActiveTrue(List.of(chennai, bengaluru));
    }

    @Test
    void anEmptyOrOversizedCityListIsRejected() {
        InternalTerritoryController controller = new InternalTerritoryController(validation, cityRepository, zoneRepository);
        assertThrows(IllegalArgumentException.class, () -> controller.zonesByCities(List.of()));
        List<UUID> tooMany = IntStream.range(0, 51).mapToObj(i -> UUID.randomUUID()).toList();
        assertThrows(IllegalArgumentException.class, () -> controller.zonesByCities(tooMany));
    }
}
