package com.example.lbos.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Response shapes of the Location Manager dashboard. Everything in them is already limited to the caller's zone; people
 * and places are named, never identified by id (the few ids present are only handles for the follow-up calls).
 */
public final class LocationDashboardDTOs {

    private LocationDashboardDTOs() {
    }

    public record Summary(
            String zoneName, String cityName, LocalDate from, LocalDate to,
            // current state - not affected by the date range
            long totalRetailers, long activeRetailers, long totalFleetOwners, long activeFleetOwners,
            long pendingVerifications, Long activeOrders,
            // activity inside the selected range
            long completedVerifications, long rejectedRequests, Long completedOrders,
            List<TrendPoint> onboardingTrend,
            List<WorkloadItem> workload,
            List<VerificationBySubject> verificationBySubject) {
    }

    /** New retailer / fleet-owner applications in one day (or week, for long ranges). */
    public record TrendPoint(LocalDate date, long retailers, long fleetOwners) {
    }

    /** Pending work by kind, e.g. "Awaiting review" - "Retailer" - 4. */
    public record WorkloadItem(String category, String subjectType, long count) {
    }

    public record VerificationBySubject(String subjectType, long pending, long approved, long rejected) {
    }

    public record UserRow(
            String userType, UUID id, String businessName, String contactName, String email, String phone,
            String onboardingStatus, String verificationStatus, String activationStatus, String pendingAction,
            UUID verificationQueueId, OffsetDateTime onboardingStartedAt, Double rating, Long ratingCount) {
    }

    public record UserPage(List<UserRow> items, long totalElements, int page, int size) {
    }

    public record Review(short rating, String comment, String productName, OffsetDateTime createdAt) {
    }

    public record ReviewPage(double average, long count, List<Review> items, long totalElements, int page, int size) {
    }

    public record DriverRow(String name, String status, Double rating) {
    }

    public record VehicleRow(String registrationNumber, String vehicleType, String make, String model, Integer modelYear,
                             BigDecimal capacityKg, String status) {
    }

    /** {@code ratingsAvailable} is false because no customer rating exists for fleet owners or drivers anywhere in the platform. */
    public record FleetAssets(List<DriverRow> drivers, List<VehicleRow> vehicles, boolean ratingsAvailable) {
    }
}
