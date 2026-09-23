package com.example.lbos.repository;

import com.example.lbos.entity.FleetOwner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FleetOwnerRepository extends JpaRepository<FleetOwner, UUID>,
        org.springframework.data.jpa.repository.JpaSpecificationExecutor<FleetOwner> {
    long countByZoneId(UUID zoneId);
    long countByZoneIdAndOwnerStatus(UUID zoneId, String ownerStatus);
    List<FleetOwner> findByCityId(UUID cityId);
    List<FleetOwner> findByOwnerStatus(String ownerStatus);
    List<FleetOwner> findByProfileStatus(String profileStatus);
    List<FleetOwner> findByBusinessNameContainingIgnoreCase(String businessName);
    java.util.Optional<FleetOwner> findByUserAccountId(UUID userAccountId);
}
