package com.example.lbos.service;

import com.example.lbos.client.AccountLookupClient;
import com.example.lbos.client.AccountLookupClient.AccountSummary;
import com.example.lbos.client.LocationManagerClient.LocationManagerSummary;
import com.example.lbos.client.S3CommerceClient;
import com.example.lbos.client.S4OrderClient;
import com.example.lbos.client.S5FleetClient;
import com.example.lbos.dto.LocationDashboardDTOs.*;
import com.example.lbos.entity.FleetOwner;
import com.example.lbos.entity.Retailer;
import com.example.lbos.entity.VerificationQueue;
import com.example.lbos.exception.RetailerNotFoundException;
import com.example.lbos.exception.FleetOwnerNotFoundException;
import com.example.lbos.repository.FleetOwnerRepository;
import com.example.lbos.repository.RetailerRepository;
import com.example.lbos.repository.VerificationQueueRepository;
import com.example.lbos.repository.VerificationQueueRepository.StatusCountRow;
import com.example.lbos.security.ZoneScope;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The Location Manager's zone dashboard. Every read is anchored on the zone the caller is assigned to in S1 (never a
 * zone sent by the browser), filtering / sorting / paging happen in the database, and a page of partners costs a fixed
 * number of calls (one accounts batch, one rating batch, one queue query) however many rows it has.
 *
 * <p>Definitions are the platform's existing ones: retailer active = VERIFIED, fleet owner active = ownerStatus ACTIVE,
 * order in progress = not terminal, completed = DELIVERED, pending verification = {@link VerificationWork}.
 */
@Service
public class LocationDashboardService {

    private static final Logger log = LoggerFactory.getLogger(LocationDashboardService.class);
    private static final int MAX_RANGE_DAYS = 366;
    private static final int DAILY_BUCKET_LIMIT_DAYS = 62;

    private final VerificationQueueRepository queues;
    private final RetailerRepository retailers;
    private final FleetOwnerRepository fleetOwners;
    private final ZoneScope zoneScope;
    private final AccountLookupClient accounts;
    private final S3CommerceClient commerce;
    private final S4OrderClient orders;
    private final S5FleetClient fleet;

    public LocationDashboardService(VerificationQueueRepository queues, RetailerRepository retailers,
                                    FleetOwnerRepository fleetOwners, ZoneScope zoneScope, AccountLookupClient accounts,
                                    S3CommerceClient commerce, S4OrderClient orders, S5FleetClient fleet) {
        this.queues = queues;
        this.retailers = retailers;
        this.fleetOwners = fleetOwners;
        this.zoneScope = zoneScope;
        this.accounts = accounts;
        this.commerce = commerce;
        this.orders = orders;
        this.fleet = fleet;
    }

    // ------------------------------------------------------------------ summary

    /*
    ##################################################################
    
                                               CR_CHG0030046_Location_Manager_Dashboard_3239859
    
    #####################################################################
    */
    @Transactional(readOnly = true)
    public Summary summary(LocalDate fromDate, LocalDate toDate) {
        LocationManagerSummary lm = zoneScope.assignment();
        UUID zone = lm.zoneId();
        UUID me = ZoneScope.callerAccountId();
        LocalDate to = toDate == null ? LocalDate.now() : toDate;
        LocalDate from = fromDate == null ? to.minusDays(29) : fromDate;
        if (from.isAfter(to)) {
            throw new IllegalArgumentException("The start date must not be after the end date");
        }
        if (ChronoUnit.DAYS.between(from, to) > MAX_RANGE_DAYS) {
            throw new IllegalArgumentException("The date range can span at most " + MAX_RANGE_DAYS + " days");
        }
        ZoneId clock = ZoneId.systemDefault();
        OffsetDateTime start = from.atStartOfDay(clock).toOffsetDateTime();
        OffsetDateTime end = to.plusDays(1).atStartOfDay(clock).toOffsetDateTime();

        // Verification: pending is "right now"; approved / rejected are decisions made inside the range.
        Map<String, Long[]> bySubject = new LinkedHashMap<>();
        List<WorkloadItem> workload = new ArrayList<>();
        long pending = 0;
        for (StatusCountRow row : queues.countPendingByType(me, zone, VerificationWork.PENDING_STATUSES)) {
            pending += row.getTotal();
            bySubject.computeIfAbsent(row.getSubjectType(), k -> new Long[] {0L, 0L, 0L})[0] += row.getTotal();
            workload.add(new WorkloadItem("SENT_TO_LOCATION_MANAGER".equals(row.getStatus()) ? "Awaiting review" : "Re-upload required",
                    row.getSubjectType(), row.getTotal()));
        }
        long approved = 0;
        long rejected = 0;
        for (StatusCountRow row : queues.countDecidedByZone(zone, start, end)) {
            boolean isApproved = "APPROVED".equals(row.getStatus());
            if (isApproved) approved += row.getTotal(); else rejected += row.getTotal();
            bySubject.computeIfAbsent(row.getSubjectType(), k -> new Long[] {0L, 0L, 0L})[isApproved ? 1 : 2] += row.getTotal();
        }
        List<VerificationBySubject> verification = bySubject.entrySet().stream()
                .map(e -> new VerificationBySubject(e.getKey(), e.getValue()[0], e.getValue()[1], e.getValue()[2])).toList();

        // Orders: S4 owns them; a failure there must not blank the rest of the dashboard.
        Long activeOrders = null;
        Long completedOrders = null;
        List<UUID> retailerIds = retailers.findRetailerIdsByZoneId(zone);
        if (retailerIds.isEmpty()) {
            activeOrders = 0L;
            completedOrders = 0L;
        } else {
            try {
                S4OrderClient.OrderStatsResponse stats = orders.orderStats(
                        new S4OrderClient.OrderStatsRequest(retailerIds, start.toLocalDateTime(), end.toLocalDateTime()));
                activeOrders = stats.activeOrders();
                completedOrders = stats.completedOrders();
            } catch (Exception failure) {
                log.warn("Order statistics unavailable for zone {}: {}", zone, failure.getMessage());
            }
        }

        return new Summary(lm.zoneName(), lm.cityName(), from, to,
                retailers.countByZoneId(zone), retailers.countByZoneIdAndRetailerStatus(zone, "VERIFIED"),
                fleetOwners.countByZoneId(zone), fleetOwners.countByZoneIdAndOwnerStatus(zone, "ACTIVE"),
                pending, activeOrders, approved, rejected, completedOrders,
                onboardingTrend(zone, from, to, start, end), workload, verification);
    }

    /** New applications per day (per week when the range is long); each partner counts once per bucket. */
    private List<TrendPoint> onboardingTrend(UUID zone, LocalDate from, LocalDate to, OffsetDateTime start, OffsetDateTime end) {
        boolean daily = ChronoUnit.DAYS.between(from, to) <= DAILY_BUCKET_LIMIT_DAYS;
        Function<LocalDate, LocalDate> bucket = day -> daily ? day : day.with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
        Map<LocalDate, Set<UUID>> retailerBuckets = new HashMap<>();
        Map<LocalDate, Set<UUID>> ownerBuckets = new HashMap<>();
        ZoneId clock = ZoneId.systemDefault();
        for (VerificationQueueRepository.OnboardingRow row : queues.findOnboardingStarts(zone, start, end)) {
            LocalDate key = bucket.apply(row.getCreatedAt().atZoneSameInstant(clock).toLocalDate());
            ("RETAILER".equals(row.getSubjectType()) ? retailerBuckets : ownerBuckets)
                    .computeIfAbsent(key, k -> new HashSet<>()).add(row.getSubjectId());
        }
        List<TrendPoint> points = new ArrayList<>();
        for (LocalDate cursor = bucket.apply(from); !cursor.isAfter(to); cursor = cursor.plusDays(daily ? 1 : 7)) {
            points.add(new TrendPoint(cursor,
                    retailerBuckets.getOrDefault(cursor, Set.of()).size(), ownerBuckets.getOrDefault(cursor, Set.of()).size()));
        }
        return points;
    }

    // ------------------------------------------------------------------ partners of the zone

    public record UserQuery(String type, String search, String onboardingStatus, String verificationStatus,
                            String activation, String pendingAction, String sort, String direction, int page, int size) {
    }

    private static final Map<String, List<String>> PENDING_ACTION_STATUSES = Map.of(
            "REVIEW_DOCUMENTS", List.of("SENT_TO_LOCATION_MANAGER"),
            "AWAITING_REUPLOAD", List.of("RESUBMISSION_REQUIRED"),
            "AWAITING_SUBMISSION", List.of("DOCUMENTS_SUBMITTED"));

    @Transactional(readOnly = true)
    public UserPage users(UserQuery query) {
        UUID zone = zoneScope.zoneId();
        boolean fleetOwnerType = "FLEET_OWNER".equalsIgnoreCase(query.type());
        int size = Math.min(Math.max(query.size(), 1), 50);
        int page = Math.max(query.page(), 0);
        Set<UUID> matchingAccounts = matchingAccounts(query.search(), fleetOwnerType ? "FLEET_MANAGER" : "RETAILER");

        if (fleetOwnerType) {
            Specification<FleetOwner> spec = partnerSpec(zone, query, matchingAccounts, "fleetOwnerId", "profileStatus", "ownerStatus", "ACTIVE");
            Page<FleetOwner> result = fleetOwners.findAll(spec, PageRequest.of(page, size, sortFor(query, "profileStatus", "ownerStatus")));
            List<UserRow> rows = rowsFor("FLEET_OWNER", result.getContent(), FleetOwner::getFleetOwnerId, FleetOwner::getUserAccountId,
                    FleetOwner::getBusinessName, FleetOwner::getProfileStatus, owner -> "ACTIVE".equalsIgnoreCase(owner.getOwnerStatus()));
            return new UserPage(rows, result.getTotalElements(), page, size);
        }
        Specification<Retailer> spec = partnerSpec(zone, query, matchingAccounts, "retailerId", "retailerStatus", "retailerStatus", "VERIFIED");
        Page<Retailer> result = retailers.findAll(spec, PageRequest.of(page, size, sortFor(query, "retailerStatus", "retailerStatus")));
        List<UserRow> rows = rowsFor("RETAILER", result.getContent(), Retailer::getRetailerId, Retailer::getUserAccountId,
                Retailer::getBusinessName, Retailer::getRetailerStatus, retailer -> "VERIFIED".equalsIgnoreCase(retailer.getRetailerStatus()));
        return new UserPage(rows, result.getTotalElements(), page, size);
    }

    /** Accounts (by name / email / phone) that match the search text - one call, and only when there is a search. */
    private Set<UUID> matchingAccounts(String search, String role) {
        if (search == null || search.isBlank()) {
            return Set.of();
        }
        try {
            return new HashSet<>(accounts.searchIds(search.trim(), List.of(role)));
        } catch (Exception failure) {
            log.warn("Account search unavailable, searching business names only: {}", failure.getMessage());
            return Set.of();
        }
    }

    private static Sort sortFor(UserQuery query, String onboardingAttr, String activationAttr) {
        String attribute = switch (String.valueOf(query.sort())) {
            case "onboardingStatus" -> onboardingAttr;
            case "activationStatus" -> activationAttr;
            default -> "businessName";
        };
        Sort.Direction direction = "desc".equalsIgnoreCase(query.direction()) ? Sort.Direction.DESC : Sort.Direction.ASC;
        return Sort.by(direction, attribute).and(Sort.by(Sort.Direction.ASC, "businessName"));
    }

    private <T> Specification<T> partnerSpec(UUID zone, UserQuery query, Set<UUID> matchingAccounts, String idAttr,
                                             String onboardingAttr, String activationAttr, String activeValue) {
        return (Root<T> root, CriteriaQuery<?> cq, CriteriaBuilder cb) -> {
            List<Predicate> all = new ArrayList<>();
            all.add(cb.equal(root.get("zoneId"), zone));
            if (hasText(query.onboardingStatus())) {
                all.add(cb.equal(root.get(onboardingAttr), query.onboardingStatus().toUpperCase()));
            }
            if (hasText(query.activation())) {
                Predicate active = cb.equal(root.get(activationAttr), activeValue);
                all.add("ACTIVE".equalsIgnoreCase(query.activation()) ? active : cb.not(active));
            }
            if (hasText(query.verificationStatus())) {
                all.add(latestQueueStatus(root, cq, cb, idAttr, query.verificationStatus().toUpperCase()));
            }
            if (hasText(query.pendingAction())) {
                all.add(pendingActionPredicate(root, cq, cb, idAttr, query.pendingAction().toUpperCase()));
            }
            if (hasText(query.search())) {
                String pattern = "%" + query.search().trim().toLowerCase() + "%";
                Predicate byName = cb.like(cb.lower(root.get("businessName")), pattern);
                all.add(matchingAccounts.isEmpty() ? byName : cb.or(byName, root.get("userAccountId").in(matchingAccounts)));
            }
            return cb.and(all.toArray(new Predicate[0]));
        };
    }

    private <T> Predicate pendingActionPredicate(Root<T> root, CriteriaQuery<?> cq, CriteriaBuilder cb, String idAttr, String action) {
        List<String> statuses = PENDING_ACTION_STATUSES.get(action);
        if (statuses != null) {
            return latestQueueStatuses(root, cq, cb, idAttr, statuses);
        }
        // NONE: nothing waiting - never submitted, or the latest request is already decided.
        return cb.or(latestQueueStatus(root, cq, cb, idAttr, "NOT_SUBMITTED"),
                latestQueueStatuses(root, cq, cb, idAttr, List.of("APPROVED", "REJECTED")));
    }

    private <T> Predicate latestQueueStatus(Root<T> root, CriteriaQuery<?> cq, CriteriaBuilder cb, String idAttr, String status) {
        if (!"NOT_SUBMITTED".equals(status)) {
            return latestQueueStatuses(root, cq, cb, idAttr, List.of(status));
        }
        Subquery<Integer> any = cq.subquery(Integer.class);
        Root<VerificationQueue> q = any.from(VerificationQueue.class);
        any.select(cb.literal(1)).where(cb.equal(q.get("subjectId"), root.get(idAttr)));
        return cb.not(cb.exists(any));
    }

    /** True when the partner's most recent verification request has one of the statuses. */
    private <T> Predicate latestQueueStatuses(Root<T> root, CriteriaQuery<?> cq, CriteriaBuilder cb, String idAttr, Collection<String> statuses) {
        Subquery<Integer> exists = cq.subquery(Integer.class);
        Root<VerificationQueue> q = exists.from(VerificationQueue.class);
        Subquery<OffsetDateTime> latest = exists.subquery(OffsetDateTime.class);
        Root<VerificationQueue> q2 = latest.from(VerificationQueue.class);
        latest.select(cb.greatest(q2.<OffsetDateTime>get("createdAt"))).where(cb.equal(q2.get("subjectId"), root.get(idAttr)));
        exists.select(cb.literal(1)).where(
                cb.equal(q.get("subjectId"), root.get(idAttr)),
                cb.equal(q.<OffsetDateTime>get("createdAt"), latest),
                q.get("verificationStatus").in(statuses));
        return cb.exists(exists);
    }

    private <E> List<UserRow> rowsFor(String type, List<E> entities, Function<E, UUID> id, Function<E, UUID> accountId,
                                      Function<E, String> name, Function<E, String> onboarding, java.util.function.Predicate<E> active) {
        if (entities.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = entities.stream().map(id).toList();
        Map<UUID, AccountSummary> accountById = accountsById(entities.stream().map(accountId).distinct().toList());
        Map<UUID, List<VerificationQueue>> queuesBySubject = queues.findBySubjectIdIn(ids).stream()
                .collect(Collectors.groupingBy(VerificationQueue::getSubjectId));
        Map<UUID, S3CommerceClient.RetailerRating> ratings = "RETAILER".equals(type) ? ratingsById(ids) : Map.of();

        return entities.stream().map(entity -> {
            List<VerificationQueue> history = queuesBySubject.getOrDefault(id.apply(entity), List.of());
            VerificationQueue latest = history.stream().max(Comparator.comparing(VerificationQueue::getCreatedAt)).orElse(null);
            OffsetDateTime first = history.stream().map(VerificationQueue::getCreatedAt).min(Comparator.naturalOrder()).orElse(null);
            AccountSummary account = accountById.get(accountId.apply(entity));
            S3CommerceClient.RetailerRating rating = ratings.get(id.apply(entity));
            String verification = latest == null ? "NOT_SUBMITTED" : latest.getVerificationStatus();
            return new UserRow(type, id.apply(entity), name.apply(entity), contactName(account),
                    account == null ? null : account.email(), account == null ? null : account.phoneNumber(),
                    onboarding.apply(entity), verification, active.test(entity) ? "ACTIVE" : "INACTIVE", pendingAction(verification),
                    latest == null ? null : latest.getVerificationQueueId(), first,
                    rating == null ? null : rating.average(), rating == null ? null : rating.count());
        }).toList();
    }

    private static String pendingAction(String verificationStatus) {
        return switch (verificationStatus) {
            case "SENT_TO_LOCATION_MANAGER" -> "REVIEW_DOCUMENTS";
            case "RESUBMISSION_REQUIRED" -> "AWAITING_REUPLOAD";
            case "DOCUMENTS_SUBMITTED" -> "AWAITING_SUBMISSION";
            default -> "NONE";
        };
    }

    private static String contactName(AccountSummary account) {
        if (account == null) return null;
        String name = ((account.firstName() == null ? "" : account.firstName()) + " " + (account.lastName() == null ? "" : account.lastName())).trim();
        return name.isEmpty() ? null : name;
    }

    private Map<UUID, AccountSummary> accountsById(List<UUID> ids) {
        try {
            return accounts.batch(ids).stream().collect(Collectors.toMap(AccountSummary::id, a -> a, (a, b) -> a));
        } catch (Exception failure) {
            log.warn("Contact details unavailable for the partner list: {}", failure.getMessage());
            return Map.of();
        }
    }

    private Map<UUID, S3CommerceClient.RetailerRating> ratingsById(List<UUID> retailerIds) {
        try {
            return commerce.ratingSummaries(new S3CommerceClient.RatingSummariesRequest(retailerIds)).stream()
                    .collect(Collectors.toMap(S3CommerceClient.RetailerRating::retailerId, r -> r, (a, b) -> a));
        } catch (Exception failure) {
            log.warn("Retailer ratings unavailable: {}", failure.getMessage());
            return Map.of();
        }
    }

    // ------------------------------------------------------------------ one partner in detail

    /** The customer reviews of one retailer of the caller's zone (the existing product-review data, grouped by retailer). */
    @Transactional(readOnly = true)
    public ReviewPage retailerReviews(UUID retailerId, int page, int size) {
        Retailer retailer = retailers.findById(retailerId)
                .orElseThrow(() -> new RetailerNotFoundException("Retailer not found with id: " + retailerId));
        zoneScope.requireZone(retailer.getZoneId());
        S3CommerceClient.RetailerReviewPage reviews = commerce.reviewsOf(retailerId, Math.max(page, 0), Math.min(Math.max(size, 1), 50));
        S3CommerceClient.RetailerRating rating = ratingsById(List.of(retailerId)).get(retailerId);
        return new ReviewPage(rating == null ? 0 : rating.average(), rating == null ? 0 : rating.count(),
                reviews.items().stream().map(r -> new Review(r.rating(), r.comment(), r.productName(), r.createdAt())).toList(),
                reviews.totalElements(), reviews.page(), reviews.size());
    }

    /** A fleet owner's drivers and vehicles (S5's existing fleet-owner listings), for a fleet owner of the caller's zone. */
    @Transactional(readOnly = true)
    public FleetAssets fleetAssets(UUID fleetOwnerId) {
        FleetOwner owner = fleetOwners.findById(fleetOwnerId)
                .orElseThrow(() -> new FleetOwnerNotFoundException("FleetOwner not found with id: " + fleetOwnerId));
        zoneScope.requireZone(owner.getZoneId());
        List<DriverRow> drivers = List.of();
        List<VehicleRow> vehicles = List.of();
        try {
            drivers = fleet.driversOf(fleetOwnerId).stream().map(d -> new DriverRow(driverName(d), d.driverStatus(), null)).toList();
        } catch (Exception failure) {
            log.warn("Drivers of fleet owner {} unavailable: {}", fleetOwnerId, failure.getMessage());
        }
        try {
            vehicles = fleet.vehiclesOf(fleetOwnerId).stream().map(v -> new VehicleRow(v.registrationNumber(), v.vehicleType(),
                    v.make(), v.model(), v.modelYear(), v.capacityKg(), v.vehicleStatus())).toList();
        } catch (Exception failure) {
            log.warn("Vehicles of fleet owner {} unavailable: {}", fleetOwnerId, failure.getMessage());
        }
        return new FleetAssets(drivers, vehicles, false);
    }

    private static String driverName(S5FleetClient.DriverInfo driver) {
        String name = ((driver.firstName() == null ? "" : driver.firstName()) + " " + (driver.lastName() == null ? "" : driver.lastName())).trim();
        return name.isEmpty() ? driver.email() : name;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
