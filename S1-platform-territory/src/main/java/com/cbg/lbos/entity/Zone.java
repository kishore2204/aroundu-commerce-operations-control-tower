package com.cbg.lbos.entity;

import java.util.UUID;
import jakarta.persistence.*;

@Entity
@Table(name = "zone", uniqueConstraints = @UniqueConstraint(name = "uk_zone_city_name", columnNames = {"city_id", "zone_name"}))
public class Zone {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "zone_id", updatable = false, nullable = false)
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "city_id", nullable = false)
    private City city;
    @Column(name = "zone_name", nullable = false, length = 100)
    private String zoneName;
    @Column(name = "is_active", nullable = false)
    private Boolean isActive;
    public Zone() { }
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public City getCity() { return city; }
    public void setCity(City city) { this.city = city; }
    public String getZoneName() { return zoneName; }
    public void setZoneName(String zoneName) { this.zoneName = zoneName; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
}
