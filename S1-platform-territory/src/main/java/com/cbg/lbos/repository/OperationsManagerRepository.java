package com.cbg.lbos.repository;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.cbg.lbos.entity.AssignmentStatus;
import com.cbg.lbos.entity.OperationsManager;

public interface OperationsManagerRepository extends JpaRepository<OperationsManager, UUID> {
    Optional<OperationsManager> findByUserAccountId(UUID userAccountId);
    boolean existsByUserAccountId(UUID userAccountId);
    Page<OperationsManager> findByCityId(UUID cityId, Pageable pageable);
    Page<OperationsManager> findByAssignmentStatus(AssignmentStatus assignmentStatus, Pageable pageable);
    Page<OperationsManager> findByCityIdAndAssignmentStatus(UUID cityId, AssignmentStatus assignmentStatus, Pageable pageable);
    /** The Admin list: optional city / status filters plus a free-text search over name, email, phone and city.
     *  {@code term} is lower-cased and already wrapped in % by the service; an empty {@code term} means "no search". */
    @Query("select om from OperationsManager om join om.userAccount ua join om.city c "
            + "where (:cityId is null or c.id = :cityId) and (:status is null or om.assignmentStatus = :status) "
            + "and (:term = '' or lower(ua.firstName) like :term or lower(ua.lastName) like :term "
            + "or lower(concat(ua.firstName, ' ', ua.lastName)) like :term or lower(ua.email) like :term "
            + "or ua.phoneNumber like :term or lower(c.cityName) like :term)")
    Page<OperationsManager> search(@Param("cityId") UUID cityId, @Param("status") AssignmentStatus status,
                                   @Param("term") String term, Pageable pageable);
    Optional<OperationsManager> findFirstByCityIdAndAssignmentStatus(UUID cityId, AssignmentStatus assignmentStatus);
    long countByAssignmentStatus(AssignmentStatus assignmentStatus);
}
