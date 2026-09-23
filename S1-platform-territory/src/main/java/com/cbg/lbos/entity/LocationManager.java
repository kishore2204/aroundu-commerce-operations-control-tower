package com.cbg.lbos.entity;

import java.time.OffsetDateTime;
import java.util.UUID;
import jakarta.persistence.*;

/** Indexed on the columns LocationManagerRepository.search()/findTransferCandidates() actually
 *  filter/join on - none of these had an index before (only the user_account_id unique constraint did). */
@Entity
@Table(name = "location_manager", indexes = {
        @Index(name = "idx_location_manager_zone_id", columnList = "zone_id"),
        @Index(name = "idx_location_manager_operations_manager_id", columnList = "operations_manager_id"),
        @Index(name = "idx_location_manager_assignment_status", columnList = "assignment_status"),
})
public class LocationManager {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "location_manager_id", updatable = false, nullable = false)
    private UUID id;
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_account_id", nullable = false, unique = true)
    private UserAccount userAccount;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "zone_id", nullable = false)
    private Zone zone;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "operations_manager_id", nullable = false)
    private OperationsManager operationsManager;
    @Enumerated(EnumType.STRING)
    @Column(name = "assignment_status", nullable = false, length = 30)
    private AssignmentStatus assignmentStatus;
    @Column(name = "assigned_at", nullable = false)
    private OffsetDateTime assignedAt;
    public LocationManager() { }
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UserAccount getUserAccount() { return userAccount; }
    public void setUserAccount(UserAccount userAccount) { this.userAccount = userAccount; }
    public Zone getZone() { return zone; }
    public void setZone(Zone zone) { this.zone = zone; }
    public OperationsManager getOperationsManager() { return operationsManager; }
    public void setOperationsManager(OperationsManager operationsManager) { this.operationsManager = operationsManager; }
    public AssignmentStatus getAssignmentStatus() { return assignmentStatus; }
    public void setAssignmentStatus(AssignmentStatus assignmentStatus) { this.assignmentStatus = assignmentStatus; }
    public OffsetDateTime getAssignedAt() { return assignedAt; }
    public void setAssignedAt(OffsetDateTime assignedAt) { this.assignedAt = assignedAt; }
}
