package com.cbg.lbos.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.cbg.lbos.entity.TripStatusHistory;

@Repository
public interface TripStatusHistoryRepository extends JpaRepository<TripStatusHistory, UUID> {

    List<TripStatusHistory> findByTripIdOrderByChangedAtAsc(UUID tripId);
}
