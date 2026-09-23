package com.example.lbos.repository;

import com.example.lbos.entity.VerificationQueue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface VerificationQueueRepository extends JpaRepository<VerificationQueue, UUID> {
    List<VerificationQueue> findBySubjectId(UUID subjectId);
    List<VerificationQueue> findBySubjectType(String subjectType);
    List<VerificationQueue> findByVerificationStatus(String verificationStatus);
    List<VerificationQueue> findByIsActive(Boolean isActive);
    List<VerificationQueue> findBySubmittedByAccountId(UUID accountId);
    List<VerificationQueue> findByZoneId(UUID zoneId);

    /** Same as findByVerificationStatus, scoped to a single zone - backs the Location Manager's
     *  queue view, which must only ever show requests from the LM's own zone. */
    List<VerificationQueue> findByVerificationStatusAndZoneId(String verificationStatus, UUID zoneId);

    /** The one queue entry a subject can have open at a time - see VerificationQueue.isActive. */
    Optional<VerificationQueue> findFirstBySubjectIdAndIsActiveTrueOrderByCreatedAtDesc(UUID subjectId);

    /** Count of a subject's queue rows that landed on a given status (e.g. how many times REJECTED). */
    long countBySubjectIdAndVerificationStatus(UUID subjectId, String status);

    /** A reviewer's pending work: assigned to them, or unassigned in their zone - see VerificationWork. */
    @org.springframework.data.jpa.repository.Query("select q from VerificationQueue q where q.isActive = true and q.verificationStatus in :statuses "
            + "and (q.reviewedByAccountId = :reviewer or (q.reviewedByAccountId is null and q.zoneId = :zoneId)) order by q.createdAt asc")
    List<VerificationQueue> findPendingWork(@org.springframework.data.repository.query.Param("reviewer") UUID reviewerAccountId,
            @org.springframework.data.repository.query.Param("zoneId") UUID zoneId,
            @org.springframework.data.repository.query.Param("statuses") Collection<String> statuses);

    @org.springframework.data.jpa.repository.Query("select count(q) from VerificationQueue q where q.isActive = true and q.verificationStatus in :statuses "
            + "and (q.reviewedByAccountId = :reviewer or (q.reviewedByAccountId is null and q.zoneId = :zoneId))")
    long countPendingWork(@org.springframework.data.repository.query.Param("reviewer") UUID reviewerAccountId,
            @org.springframework.data.repository.query.Param("zoneId") UUID zoneId,
            @org.springframework.data.repository.query.Param("statuses") Collection<String> statuses);

    /** What a Location Manager may see: requests assigned to them, plus their zone's requests that are decided or not handed to someone else. */
    @org.springframework.data.jpa.repository.Query("select q from VerificationQueue q where (q.reviewedByAccountId = :reviewer or (q.zoneId = :zoneId "
            + "and (q.reviewedByAccountId is null or q.isActive = false or q.verificationStatus not in :pending)))")
    List<VerificationQueue> findVisibleToReviewer(@org.springframework.data.repository.query.Param("reviewer") UUID reviewerAccountId,
            @org.springframework.data.repository.query.Param("zoneId") UUID zoneId,
            @org.springframework.data.repository.query.Param("pending") Collection<String> pendingStatuses);

    /** Dashboard: decided requests of a zone, grouped, inside a time window. */
    @org.springframework.data.jpa.repository.Query("select q.subjectType as subjectType, q.verificationStatus as status, count(q) as total from VerificationQueue q "
            + "where q.zoneId = :zoneId and q.verificationStatus in ('APPROVED','REJECTED') and q.updatedAt >= :from and q.updatedAt < :to "
            + "group by q.subjectType, q.verificationStatus")
    List<StatusCountRow> countDecidedByZone(@org.springframework.data.repository.query.Param("zoneId") UUID zoneId,
            @org.springframework.data.repository.query.Param("from") java.time.OffsetDateTime from,
            @org.springframework.data.repository.query.Param("to") java.time.OffsetDateTime to);

    /** Dashboard: open requests of a zone (or assigned to the reviewer) grouped by type and status. */
    @org.springframework.data.jpa.repository.Query("select q.subjectType as subjectType, q.verificationStatus as status, count(q) as total from VerificationQueue q "
            + "where q.isActive = true and q.verificationStatus in :statuses "
            + "and (q.reviewedByAccountId = :reviewer or (q.reviewedByAccountId is null and q.zoneId = :zoneId)) group by q.subjectType, q.verificationStatus")
    List<StatusCountRow> countPendingByType(@org.springframework.data.repository.query.Param("reviewer") UUID reviewerAccountId,
            @org.springframework.data.repository.query.Param("zoneId") UUID zoneId,
            @org.springframework.data.repository.query.Param("statuses") Collection<String> statuses);

    /** Dashboard: retailer / fleet-owner onboarding applications started in a window (grouped in Java by day). */
    @org.springframework.data.jpa.repository.Query("select q.subjectType as subjectType, q.subjectId as subjectId, q.createdAt as createdAt from VerificationQueue q "
            + "where q.zoneId = :zoneId and q.subjectType in ('RETAILER','FLEET_OWNER') and q.createdAt >= :from and q.createdAt < :to")
    List<OnboardingRow> findOnboardingStarts(@org.springframework.data.repository.query.Param("zoneId") UUID zoneId,
            @org.springframework.data.repository.query.Param("from") java.time.OffsetDateTime from,
            @org.springframework.data.repository.query.Param("to") java.time.OffsetDateTime to);

    /** Every queue row of the given subjects - lets a whole page of partners get its latest status with one query. */
    List<VerificationQueue> findBySubjectIdIn(Collection<UUID> subjectIds);

    interface StatusCountRow {
        String getSubjectType();
        String getStatus();
        Long getTotal();
    }

    interface OnboardingRow {
        String getSubjectType();
        UUID getSubjectId();
        java.time.OffsetDateTime getCreatedAt();
    }

    /** Count of a reviewer's currently open (non-terminal) assigned review items - see TERMINAL_STATUSES. */
    long countByReviewedByAccountIdAndVerificationStatusNotInAndIsActiveTrue(UUID reviewerAccountId, Collection<String> excludedStatuses);
}
