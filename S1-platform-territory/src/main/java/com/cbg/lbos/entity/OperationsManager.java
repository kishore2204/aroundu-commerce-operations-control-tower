package com.cbg.lbos.entity;

import java.time.OffsetDateTime;
import java.util.UUID;
import jakarta.persistence.*;

/** Indexed on the columns OperationsManagerRepository/Service actually filter on (findByCityId,
 *  findByAssignmentStatus, search()) - neither had an index before. */
@Entity
@Table(name = "operations_manager", indexes = {
        @Index(name = "idx_operations_manager_city_id", columnList = "city_id"),
        @Index(name = "idx_operations_manager_assignment_status", columnList = "assignment_status"),
})
public class OperationsManager {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "operations_manager_id", updatable = false, nullable = false)
    private UUID id;
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_account_id", nullable = false, unique = true)
    private UserAccount userAccount;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "city_id", nullable = false)
    private City city;
    @Enumerated(EnumType.STRING)
    @Column(name = "assignment_status", nullable = false, length = 20)
    private AssignmentStatus assignmentStatus = AssignmentStatus.ACTIVE;
    @Column(name = "assigned_at", nullable = false) private OffsetDateTime assignedAt;
    @Column(name = "updated_at", nullable = false) private OffsetDateTime updatedAt;
    @Version @Column(nullable = false) private Long version = 0L;
    @PrePersist private void onCreate() { OffsetDateTime now = OffsetDateTime.now(); if (assignedAt == null) assignedAt = now; updatedAt = now; }
    @PreUpdate private void onUpdate() { updatedAt = OffsetDateTime.now(); }
    public UUID getId() { return id; } public void setId(UUID id) { this.id = id; }
    public UserAccount getUserAccount() { return userAccount; } public void setUserAccount(UserAccount userAccount) { this.userAccount = userAccount; }
    public City getCity() { return city; } public void setCity(City city) { this.city = city; }
    public AssignmentStatus getAssignmentStatus() { return assignmentStatus; } public void setAssignmentStatus(AssignmentStatus assignmentStatus) { this.assignmentStatus = assignmentStatus; }
    public OffsetDateTime getAssignedAt() { return assignedAt; } public void setAssignedAt(OffsetDateTime assignedAt) { this.assignedAt = assignedAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; } public Long getVersion() { return version; }
}
