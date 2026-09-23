package com.cbg.lbos.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.cbg.lbos.entity.LocationManagerAssignmentHistory;

public interface LocationManagerAssignmentHistoryRepository extends JpaRepository<LocationManagerAssignmentHistory, UUID> {

    /** Newest first - one query for a whole page of officers, so listing them stays free of N+1. */
    List<LocationManagerAssignmentHistory> findByLocationManagerIdInOrderByChangedAtDesc(Collection<UUID> locationManagerIds);

    List<LocationManagerAssignmentHistory> findByLocationManagerIdOrderByChangedAtDesc(UUID locationManagerId);
}
