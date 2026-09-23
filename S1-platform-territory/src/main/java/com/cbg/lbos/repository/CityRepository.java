package com.cbg.lbos.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.cbg.lbos.entity.City;

public interface CityRepository extends JpaRepository<City, UUID> {
    Page<City> findByIsActive(Boolean isActive, Pageable pageable);

    boolean existsByStateIdAndCityNameIgnoreCase(UUID stateId, String cityName);

    boolean existsByStateIdAndCityNameIgnoreCaseAndIdNot(UUID stateId, String cityName, UUID cityId);

    List<City> findByIsActiveTrueAndCityNameContainingIgnoreCase(String cityName);

    List<City> findByIsActiveTrue();
}
