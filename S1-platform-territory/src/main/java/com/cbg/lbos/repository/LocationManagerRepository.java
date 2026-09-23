package com.cbg.lbos.repository;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.cbg.lbos.entity.AssignmentStatus;
import com.cbg.lbos.entity.LocationManager;

public interface LocationManagerRepository extends JpaRepository<LocationManager, UUID> {
    boolean existsByUserAccountId(UUID userAccountId);
    Optional<LocationManager> findFirstByUserAccountIdOrderByAssignedAtDesc(UUID userAccountId);
    /** A Location Manager's assignment together with its supervising Operations Manager and that
     *  manager's account, in one query - used by the login/session eligibility check, which runs
     *  outside a transaction (open-in-view is off), so nothing here may be lazily loaded. */
    @Query("select lm from LocationManager lm join fetch lm.operationsManager om join fetch om.userAccount " +
           "where lm.userAccount.id = :userAccountId")
    Optional<LocationManager> findWithSupervisorByUserAccountId(@Param("userAccountId") UUID userAccountId);
    boolean existsByZoneIdAndAssignmentStatus(UUID zoneId, AssignmentStatus assignmentStatus);
    /** A zone may have several Location Managers: every ACTIVE one, longest-serving first. */
    java.util.List<LocationManager> findByZoneIdAndAssignmentStatusOrderByAssignedAtAsc(UUID zoneId, AssignmentStatus assignmentStatus);

    /** Location Managers who can take over another officer's verification work: an ACTIVE assignment on an ACTIVE
     *  LOCATION_MANAGER account, in the given state, other than the officer being relieved. */
    @Query("select lm from LocationManager lm join fetch lm.userAccount ua join fetch lm.zone z join fetch z.city c " +
           "where c.state.id = :stateId and lm.id <> :excludedId and lm.assignmentStatus = :status " +
           "and upper(ua.accountStatus) = 'ACTIVE' and upper(ua.role) = 'LOCATION_MANAGER' " +
           "order by c.cityName, z.zoneName")
    java.util.List<LocationManager> findTransferCandidates(@Param("stateId") UUID stateId,
            @Param("excludedId") UUID excludedLocationManagerId, @Param("status") AssignmentStatus status);

    @Query("select locationManager from LocationManager locationManager " +
           "where (:zoneId is null or locationManager.zone.id = :zoneId) " +
           "and (:operationsManagerId is null or locationManager.operationsManager.id = :operationsManagerId) " +
           "and (:assignmentStatus is null or locationManager.assignmentStatus = :assignmentStatus)")
    Page<LocationManager> search(
            @Param("zoneId") UUID zoneId,
            @Param("operationsManagerId") UUID operationsManagerId,
            @Param("assignmentStatus") AssignmentStatus assignmentStatus,
            Pageable pageable);

    /**
     * Same filters as {@link #search}, plus a case-insensitive "contains" match of a pattern (already lower-cased and wrapped in
     * %...%) against the officer's full name or e-mail - the Operations Manager's Location Managers page filter by name.
     */
    @Query(value = "select locationManager from LocationManager locationManager join locationManager.userAccount ua " +
           "where (:zoneId is null or locationManager.zone.id = :zoneId) " +
           "and (:operationsManagerId is null or locationManager.operationsManager.id = :operationsManagerId) " +
           "and (:assignmentStatus is null or locationManager.assignmentStatus = :assignmentStatus) " +
           "and (lower(concat(coalesce(ua.firstName, ''), ' ', coalesce(ua.lastName, ''))) like :namePattern " +
           "or lower(coalesce(ua.email, '')) like :namePattern)",
           countQuery = "select count(locationManager) from LocationManager locationManager join locationManager.userAccount ua " +
           "where (:zoneId is null or locationManager.zone.id = :zoneId) " +
           "and (:operationsManagerId is null or locationManager.operationsManager.id = :operationsManagerId) " +
           "and (:assignmentStatus is null or locationManager.assignmentStatus = :assignmentStatus) " +
           "and (lower(concat(coalesce(ua.firstName, ''), ' ', coalesce(ua.lastName, ''))) like :namePattern " +
           "or lower(coalesce(ua.email, '')) like :namePattern)")
    Page<LocationManager> searchByName(
            @Param("zoneId") UUID zoneId,
            @Param("operationsManagerId") UUID operationsManagerId,
            @Param("assignmentStatus") AssignmentStatus assignmentStatus,
            @Param("namePattern") String namePattern,
            Pageable pageable);
}
