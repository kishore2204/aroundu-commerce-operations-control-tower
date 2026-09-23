package com.cbg.lbos.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.cbg.lbos.entity.State;

@Repository
public interface StateRepository
        extends JpaRepository<State, UUID> {

    List<State> findByCountryCodeIgnoreCase(String countryCode);

    List<State> findByIsActive(Boolean isActive);

    boolean existsByStateNameIgnoreCaseAndCountryCodeIgnoreCase(
            String stateName,
            String countryCode);
}