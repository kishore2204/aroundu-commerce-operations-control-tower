package com.example.lbos.repository;

import com.example.lbos.entity.Retailer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RetailerRepository extends JpaRepository<Retailer, UUID>,
        org.springframework.data.jpa.repository.JpaSpecificationExecutor<Retailer> {
    long countByZoneId(UUID zoneId);
    long countByZoneIdAndRetailerStatus(UUID zoneId, String retailerStatus);
    /** Ids only (no entities) - the retailers whose orders a zone's dashboard counts. */
    @org.springframework.data.jpa.repository.Query("select r.retailerId from Retailer r where r.zoneId = :zoneId")
    List<UUID> findRetailerIdsByZoneId(@org.springframework.data.repository.query.Param("zoneId") UUID zoneId);
    List<Retailer> findByCityId(UUID cityId);
    /** Backs the customer-facing zone-based catalogue filter - see InternalRetailerController. */
    List<Retailer> findByZoneIdAndRetailerStatus(UUID zoneId, String retailerStatus);
    List<Retailer> findByRetailerStatus(String retailerStatus);
    List<Retailer> findByBusinessNameContainingIgnoreCase(String businessName);
    java.util.Optional<Retailer> findByUserAccountId(UUID userAccountId);
}
