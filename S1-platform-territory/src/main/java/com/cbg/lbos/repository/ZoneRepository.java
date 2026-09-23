package com.cbg.lbos.repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.cbg.lbos.entity.Zone;

public interface ZoneRepository extends JpaRepository<Zone, UUID> {
    boolean existsByCityIdAndZoneNameIgnoreCase(UUID cityId, String zoneName);
    boolean existsByCityIdAndZoneNameIgnoreCaseAndIdNot(UUID cityId, String zoneName, UUID zoneId);

    @Query("select zone from Zone zone where (:cityId is null or zone.city.id = :cityId) " +
           "and (:active is null or zone.isActive = :active)")
    Page<Zone> search(@Param("cityId") UUID cityId, @Param("active") Boolean active, Pageable pageable);

    List<Zone> findByCity_IdAndIsActiveTrueAndZoneNameContainingIgnoreCase(UUID cityId, String zoneName);

    List<Zone> findByCity_IdAndIsActiveTrue(UUID cityId);

    /** Backs GET /internal/v1/territories/zones/by-cities - every active zone across several
     *  cities in one query, instead of one query per city (see InternalTerritoryController). */
    List<Zone> findByCity_IdInAndIsActiveTrue(java.util.Collection<UUID> cityIds);
}
