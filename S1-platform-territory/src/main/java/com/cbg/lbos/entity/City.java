package com.cbg.lbos.entity;

import java.util.UUID;
import jakarta.persistence.*;

@Entity
@Table(name = "city")
public class City {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "city_id", updatable = false, nullable = false)
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "state_id", nullable = false)
    private State state;
    @Column(name = "city_name", nullable = false) private String cityName;
    @Column(name = "is_active", nullable = false) private Boolean isActive = true;
    public UUID getId() { return id; } public void setId(UUID id) { this.id = id; }
    public State getState() { return state; } public void setState(State state) { this.state = state; }
    public String getCityName() { return cityName; } public void setCityName(String cityName) { this.cityName = cityName; }
    public Boolean getIsActive() { return isActive; } public void setIsActive(Boolean isActive) { this.isActive = isActive; }
}
