package com.cbg.lbos.entity;


import jakarta.persistence.*;
import java.util.UUID;


@Entity
@Table(name = "state")
public class State {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "state_id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "state_name", nullable = false)
    private String stateName;

    @Column(name = "country_code", nullable = false)
    private String countryCode;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive;

    public State() {
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getStateName() {
        return stateName;
    }

    public void setStateName(String stateName) {
        this.stateName = stateName;
    }

    public String getCountryCode() {
        return countryCode;
    }

    public void setCountryCode(String countryCode) {
        this.countryCode = countryCode;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }
}