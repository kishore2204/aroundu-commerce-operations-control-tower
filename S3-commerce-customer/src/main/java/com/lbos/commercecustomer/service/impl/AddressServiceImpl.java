package com.lbos.commercecustomer.service.impl;

import com.lbos.commercecustomer.client.PlatformTerritoryClient;
import com.lbos.commercecustomer.dto.client.platform.*;
import com.lbos.commercecustomer.dto.request.AddressRequest;
import com.lbos.commercecustomer.dto.response.*;
import com.lbos.commercecustomer.entity.*;
import com.lbos.commercecustomer.exception.*;
import com.lbos.commercecustomer.mapper.CommerceMapper;
import com.lbos.commercecustomer.repository.CustomerAddressRepository;
import com.lbos.commercecustomer.repository.CustomerCartItemRepository;
import com.lbos.commercecustomer.service.AddressService;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/**
 * Addresses are captured from the customer as human-readable city/zone names and resolved to
 * S1 (lbos-platform)'s internal UUIDs via its internal territory-lookup endpoints before the
 * existing /internal/v1/territories/validate call runs - the entity/DB schema still stores only
 * the resolved UUIDs, unchanged.
 */
@Service
public class AddressServiceImpl implements AddressService {

    private final CustomerAddressRepository repo;
    private final ContextSupport ctx;
    private final PlatformTerritoryClient platform;
    private final CommerceMapper map;
    private final FeignCallSupport feign;
    private final CustomerCartItemRepository cartItems;

    public AddressServiceImpl(CustomerAddressRepository r, ContextSupport c, PlatformTerritoryClient p, CommerceMapper m, FeignCallSupport g, CustomerCartItemRepository cartItemRepository) {
        repo = r;
        ctx = c;
        platform = p;
        map = m;
        feign = g;
        cartItems = cartItemRepository;
    }

    /** A customer-typed city/zone name pair, resolved to S1's internal UUIDs. */
    private record ResolvedTerritory(UUID cityId, String cityName, UUID zoneId, String zoneName) {
    }

    /** cityId -> cityName / zoneId -> zoneName, for displaying names on already-stored addresses. */
    private record TerritoryNames(Map<UUID, String> cityNames, Map<UUID, String> zoneNames) {
    }

    /**
     * Resolves the customer-typed cityName/zoneName to S1's internal UUIDs. S1's lookup
     * endpoints do a "contains" search, so more than one candidate can come back - an exact
     * case-insensitive name match is preferred among the results; zero or multiple ambiguous
     * matches fail with a clean BusinessValidationException (422) rather than a 500. Resolving
     * the zone scoped to the already-resolved cityId also enforces "zone belongs to city"
     * locally, in addition to the /validate call that still runs afterwards.
     */
    private ResolvedTerritory resolve(String cityName, String zoneName) {
        List<CityLookupResponse> cities = feign.call("lbos-platform", () -> platform.cities(cityName));
        CityLookupResponse city = pickExactMatch(cities, CityLookupResponse::cityName, cityName, "city");
        List<ZoneLookupResponse> zones = feign.call("lbos-platform", () -> platform.zones(city.cityId(), zoneName));
        ZoneLookupResponse zone = pickExactMatch(zones, ZoneLookupResponse::zoneName, zoneName, "zone");
        return new ResolvedTerritory(city.cityId(), city.cityName(), zone.zoneId(), zone.zoneName());
    }

    private <T> T pickExactMatch(List<T> candidates, Function<T, String> nameOf, String requested, String label) {
        if (candidates == null || candidates.isEmpty()) {
            throw new BusinessValidationException("No such " + label + ": " + requested);
        }
        if (candidates.size() == 1) {
            return candidates.get(0);
        }
        List<T> exact = candidates.stream().filter(candidate -> nameOf.apply(candidate).equalsIgnoreCase(requested)).toList();
        if (exact.size() == 1) {
            return exact.get(0);
        }
        throw new BusinessValidationException("Multiple " + label + "s match '" + requested + "', please be more specific");
    }

    private void validateTerritory(ResolvedTerritory territory, AddressRequest r) {
        var territoryValidation = feign.call("lbos-platform",
                () -> platform.validate(new TerritoryValidationRequest(territory.cityId(), territory.zoneId(), r.postalCode(), r.latitude(), r.longitude())));
        if (territoryValidation == null || !territoryValidation.valid()) {
            throw new BusinessValidationException("Invalid territory reference");
        }
    }

    /**
     * Looks up display names for already-stored addresses' cityId/zoneId, for responses that
     * were not just produced by resolve() (get/list/setDefault/defaultAddress). Cities are
     * fetched once for the whole batch; zones once for every distinct cityId present that isn't
     * already cache-fresh, in a single call (see zoneNamesFor()) rather than one call per city -
     * a customer with addresses in N different cities previously cost N sequential Feign round
     * trips just to label the list with zone names.
     */
    private TerritoryNames territoryNames(List<CustomerAddress> addresses) {
        if (addresses.isEmpty()) {
            return new TerritoryNames(Map.of(), Map.of());
        }
        Map<UUID, String> cityNames = cachedCityNames();
        Set<UUID> cityIds = addresses.stream().map(CustomerAddress::getCityId).filter(Objects::nonNull).collect(Collectors.toSet());
        return new TerritoryNames(cityNames, zoneNamesFor(cityIds));
    }

    /**
     * City and zone names are reference data that almost never change, but listing addresses (every open of the
     * header's address menu) used to ask S1 for them on every call - one request for the cities plus one per city.
     * They are now remembered in memory for a few minutes; they only ever label addresses that store the ids, so a
     * renamed zone shows up within the TTL. An answer that could not be read is not remembered.
     */
    private static final long TERRITORY_NAME_TTL_NANOS = java.util.concurrent.TimeUnit.MINUTES.toNanos(5);
    private record TimedNames(Map<UUID, String> names, long expiresAtNanos) { boolean fresh() { return System.nanoTime() < expiresAtNanos; } }
    private volatile TimedNames cityNamesCache;
    private final java.util.concurrent.ConcurrentHashMap<UUID, TimedNames> zoneNamesCache = new java.util.concurrent.ConcurrentHashMap<>();

    private Map<UUID, String> cachedCityNames() {
        TimedNames cached = cityNamesCache;
        if (cached != null && cached.fresh()) return cached.names();
        List<CityLookupResponse> cities = feign.call("lbos-platform", () -> platform.cities(null));
        if (cities == null) return Map.of();
        Map<UUID, String> names = cities.stream().collect(Collectors.toMap(CityLookupResponse::cityId, CityLookupResponse::cityName, (a, b) -> a));
        cityNamesCache = new TimedNames(names, System.nanoTime() + TERRITORY_NAME_TTL_NANOS);
        return names;
    }

    /**
     * Zone display names for every city in {@code cityIds}, fetching only the cities that are not
     * already cache-fresh - and fetching all of those in ONE Feign call
     * (platform.zonesByCities()) instead of one call per city. A city with zero zones still gets
     * an (empty) cache entry so it isn't re-fetched on every call until its TTL expires.
     */
    private Map<UUID, String> zoneNamesFor(Set<UUID> cityIds) {
        Map<UUID, String> result = new HashMap<>();
        List<UUID> toFetch = new ArrayList<>();
        for (UUID cityId : cityIds) {
            TimedNames cached = zoneNamesCache.get(cityId);
            if (cached != null && cached.fresh()) {
                result.putAll(cached.names());
            } else {
                toFetch.add(cityId);
            }
        }
        if (toFetch.isEmpty()) {
            return result;
        }
        List<ZoneLookupResponse> zones = feign.call("lbos-platform", () -> platform.zonesByCities(toFetch));
        Map<UUID, Map<UUID, String>> byCity = new HashMap<>();
        toFetch.forEach(cityId -> byCity.put(cityId, new HashMap<>()));
        if (zones != null) {
            zones.forEach(zone -> byCity.computeIfAbsent(zone.cityId(), k -> new HashMap<>()).put(zone.zoneId(), zone.zoneName()));
        }
        long expiresAtNanos = System.nanoTime() + TERRITORY_NAME_TTL_NANOS;
        byCity.forEach((cityId, names) -> {
            zoneNamesCache.put(cityId, new TimedNames(names, expiresAtNanos));
            result.putAll(names);
        });
        return result;
    }

    private AddressResponse toResponse(CustomerAddress address) {
        var names = territoryNames(List.of(address));
        return map.address(address, names.cityNames().get(address.getCityId()), names.zoneNames().get(address.getZoneId()));
    }

    private CustomerAddress owned(UUID id, UUID c) {
        return repo.findByIdAndCustomerId(id, c).orElseThrow(() -> new ResourceNotFoundException("Address not found"));
    }


    /** The cart is bound to the active delivery location. Changing that location while lines
     * exist would invalidate serviceability and pricing, so the backend rejects the change. */
    private void ensureActiveAddressCanChange(UUID customerId) {
        if (!cartItems.findByCartCustomerId(customerId).isEmpty()) {
            throw new BusinessValidationException("You can't switch your delivery address while your cart contains items. Please clear your cart before changing the address.");
        }
    }

    private void apply(CustomerAddress address, AddressRequest r, ResolvedTerritory territory) {
        address.setCityId(territory.cityId());
        address.setZoneId(territory.zoneId());
        address.setAddressTag(r.addressTag().trim());
        address.setLine1(r.line1().trim());
        address.setLine2(r.line2());
        address.setPostalCode(r.postalCode());
        address.setLatitude(r.latitude());
        address.setLongitude(r.longitude());
    }

    @Transactional
    public AddressResponse create(AddressRequest r) {
        var territory = resolve(r.cityName(), r.zoneName());
        validateTerritory(territory, r);
        var customer = ctx.customer();
        var address = new CustomerAddress();
        address.setCustomer(customer);
        apply(address, r, territory);
        boolean firstAddress = repo.findByCustomerIdOrderByIdAsc(customer.getId()).isEmpty();
        address.setDefaultAddress(r.defaultAddress() || firstAddress);
        if (r.defaultAddress() && !firstAddress) {
            ensureActiveAddressCanChange(customer.getId());
        }
        if (address.isDefaultAddress()) {
            repo.findByCustomerIdAndDefaultAddressTrue(customer.getId()).ifPresent(previousDefault -> previousDefault.setDefaultAddress(false));
        }
        return map.address(repo.save(address), territory.cityName(), territory.zoneName());
    }

    @Transactional(readOnly = true)
    public AddressResponse get(UUID id) {
        var customer = ctx.customer();
        return toResponse(owned(id, customer.getId()));
    }

    @Transactional(readOnly = true)
    public PageResponse<AddressResponse> list(int p, int z) {
        var all = repo.findByCustomerIdOrderByIdAsc(ctx.customer().getId());
        var sub = all.stream().skip((long) p * z).limit(z).toList();
        var names = territoryNames(sub);
        var mapped = sub.stream()
                .map(address -> map.address(address, names.cityNames().get(address.getCityId()), names.zoneNames().get(address.getZoneId())))
                .toList();
        return new PageResponse<>(mapped, p, z, all.size(), (all.size() + z - 1) / z);
    }

    @Transactional
    public AddressResponse update(UUID id, AddressRequest r) {
        var territory = resolve(r.cityName(), r.zoneName());
        validateTerritory(territory, r);
        var customer = ctx.customer();
        var address = owned(id, customer.getId());
        boolean activeAddressWouldChange = address.isDefaultAddress() &&
                (!Objects.equals(address.getCityId(), territory.cityId()) ||
                 !Objects.equals(address.getZoneId(), territory.zoneId()) ||
                 !Objects.equals(address.getLine1(), r.line1().trim()) ||
                 !Objects.equals(address.getLine2(), r.line2()) ||
                 !Objects.equals(address.getPostalCode(), r.postalCode()));
        if (activeAddressWouldChange || (r.defaultAddress() && !address.isDefaultAddress())) {
            ensureActiveAddressCanChange(customer.getId());
        }
        apply(address, r, territory);
        if (r.defaultAddress()) {
            return setDefault(id);
        }
        return map.address(repo.save(address), territory.cityName(), territory.zoneName());
    }

    @Transactional
    public void delete(UUID id) {
        var customer = ctx.customer();
        var address = owned(id, customer.getId());
        var all = repo.findByCustomerIdOrderByIdAsc(customer.getId());
        if (address.isDefaultAddress()) {
            ensureActiveAddressCanChange(customer.getId());
        }
        if (address.isDefaultAddress() && all.size() == 1) {
            throw new BusinessValidationException("Add another address before deleting your only default address");
        }
        repo.delete(address);
        if (address.isDefaultAddress()) {
            var replacement = all.stream().filter(candidate -> !candidate.getId().equals(id)).findFirst().orElseThrow();
            replacement.setDefaultAddress(true);
            repo.save(replacement);
        }
    }

    @Transactional(readOnly = true)
    public AddressResponse defaultAddress() {
        var customer = ctx.customer();
        return toResponse(repo.findByCustomerIdAndDefaultAddressTrue(customer.getId()).orElseThrow(() -> new ResourceNotFoundException("Default address not found")));
    }

    @Transactional
    public AddressResponse setDefault(UUID id) {
        var customer = ctx.customer();
        var address = owned(id, customer.getId());
        if (!address.isDefaultAddress()) {
            ensureActiveAddressCanChange(customer.getId());
        }
        repo.findByCustomerIdAndDefaultAddressTrue(customer.getId()).ifPresent(previousDefault -> {
            previousDefault.setDefaultAddress(false);
            repo.save(previousDefault);
        });
        address.setDefaultAddress(true);
        return toResponse(repo.save(address));
    }
}
