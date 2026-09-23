package com.lbos.finance.support;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The ticket_category/ticket_sub_category columns are plain varchar with no CHECK constraint
 * (see database.sql's SUPPORT TICKET section) - this is the one place that actually validates
 * a submitted category/subcategory against a real, role-appropriate taxonomy, so a ticket can
 * never be created with a category that makes no sense for who raised it (a CUSTOMER filing
 * a "SETTLEMENT_DELAYED" retailer complaint, for instance).
 *
 * Categories are grouped by the raiser's role at ticket-creation time (SupportTicket.raisedByRole).
 * LOCATION_MANAGER/OPERATIONS_MANAGER/SUPER_ADMIN/SUPPORT_STAFF share one "internal staff"
 * taxonomy since all four raise tickets for the same kind of reason: an internal/systemic issue
 * they can't resolve themselves, not a customer-facing complaint.
 *
 * The frontend mirrors this exact taxonomy in support-ticket-categories.ts for the category/
 * subcategory dropdowns - kept manually in sync (same pattern already used for order/trip/
 * expense status strings elsewhere in this codebase, which are also duplicated rather than
 * fetched from an API). This class is the actual source of truth and the only place enforced.
 */
public final class SupportTicketCategories {

    private static final Map<String, Map<String, List<String>>> BY_ROLE = new LinkedHashMap<>();

    private static void register(String role, Map<String, List<String>> categories) {
        BY_ROLE.put(role, categories);
    }

    static {
        Map<String, List<String>> customer = new LinkedHashMap<>();
        customer.put("ORDER_ISSUE", List.of(
                "ITEM_MISSING", "WRONG_ITEM_DELIVERED", "ITEM_DAMAGED",
                "ORDER_NOT_DELIVERED", "LATE_DELIVERY", "ORDER_CANCELLED_BY_RETAILER"));
        customer.put("PAYMENT_ISSUE", List.of(
                "PAYMENT_FAILED_AMOUNT_DEBITED", "REFUND_NOT_RECEIVED", "DOUBLE_CHARGE", "INVOICE_DISCREPANCY"));
        customer.put("DELIVERY_ISSUE", List.of(
                "DELIVERY_PARTNER_BEHAVIOR", "WRONG_DELIVERY_ADDRESS", "CONTACTLESS_DELIVERY_NOT_FOLLOWED"));
        customer.put("RETURN_REFUND", List.of(
                "RETURN_REQUEST", "REFUND_STATUS_QUERY", "REPLACEMENT_REQUEST"));
        customer.put("ACCOUNT_ISSUE", List.of(
                "LOGIN_ISSUE", "OTP_NOT_RECEIVED", "PROFILE_UPDATE_ISSUE"));
        customer.put("APP_TECHNICAL", List.of(
                "APP_CRASH_OR_ERROR", "PAYMENT_GATEWAY_ERROR", "BUG_REPORT"));
        customer.put("OTHER", List.of("GENERAL_QUERY", "FEEDBACK_SUGGESTION"));
        register("CUSTOMER", customer);

        Map<String, List<String>> retailer = new LinkedHashMap<>();
        retailer.put("ORDER_MANAGEMENT", List.of(
                "ORDER_NOT_VISIBLE", "CANNOT_ACCEPT_REJECT_ORDER", "CANCELLATION_DISPUTE"));
        retailer.put("PAYOUT_SETTLEMENT", List.of(
                "SETTLEMENT_DELAYED", "SETTLEMENT_AMOUNT_MISMATCH", "BANK_ACCOUNT_UPDATE_REQUEST"));
        retailer.put("PRODUCT_LISTING", List.of(
                "CANNOT_ADD_EDIT_PRODUCT", "INVENTORY_SYNC_ISSUE", "PRICING_ISSUE"));
        retailer.put("ACCOUNT_VERIFICATION", List.of(
                "DOCUMENT_REJECTED", "VERIFICATION_DELAYED", "GST_REGISTRATION_UPDATE"));
        retailer.put("APP_TECHNICAL", List.of("APP_CRASH_OR_ERROR", "LOGIN_ISSUE", "BUG_REPORT"));
        retailer.put("OTHER", List.of("GENERAL_QUERY", "FEEDBACK_SUGGESTION"));
        register("RETAILER", retailer);

        Map<String, List<String>> fleet = new LinkedHashMap<>();
        fleet.put("VEHICLE_ISSUE", List.of(
                "VEHICLE_BREAKDOWN", "DOCUMENT_EXPIRY_RENEWAL", "VERIFICATION_DELAYED"));
        fleet.put("DRIVER_ISSUE", List.of(
                "DRIVER_UNAVAILABLE", "LICENSE_EXPIRY", "DRIVER_CONDUCT_CONCERN"));
        fleet.put("ASSIGNMENT_ISSUE", List.of(
                "TRIP_NOT_ASSIGNED", "INCORRECT_ASSIGNMENT", "ASSIGNMENT_CONFLICT"));
        fleet.put("PAYMENT_EXPENSE", List.of(
                "EXPENSE_NOT_APPROVED", "SETTLEMENT_DELAYED", "SALARY_PAYMENT_DELAY"));
        fleet.put("APP_TECHNICAL", List.of("APP_CRASH_OR_ERROR", "LOGIN_ISSUE", "BUG_REPORT"));
        fleet.put("OTHER", List.of("SAFETY_CONCERN", "GENERAL_QUERY"));
        register("FLEET_MANAGER", fleet);

        Map<String, List<String>> driver = new LinkedHashMap<>();
        driver.put("PAYOUT_ISSUE", List.of(
                "SALARY_PAYMENT_DELAY", "EXPENSE_NOT_REIMBURSED", "PAYOUT_AMOUNT_MISMATCH"));
        driver.put("TRIP_ISSUE", List.of(
                "TRIP_NOT_ASSIGNED", "INCORRECT_ROUTE_INFO", "CUSTOMER_BEHAVIOR_CONCERN"));
        driver.put("SAFETY_CONDUCT", List.of(
                "HARASSMENT_COMPLAINT", "UNSAFE_ROUTE_CONDITION", "ACCIDENT_REPORT"));
        driver.put("VEHICLE_ISSUE", List.of("VEHICLE_CONDITION_CONCERN", "MAINTENANCE_REQUEST"));
        driver.put("APP_TECHNICAL", List.of("APP_CRASH_OR_ERROR", "LOGIN_ISSUE", "BUG_REPORT"));
        driver.put("OTHER", List.of("GENERAL_QUERY"));
        register("DRIVER", driver);

        Map<String, List<String>> staff = new LinkedHashMap<>();
        staff.put("ZONE_OPERATIONS", List.of("STAFFING_SHORTAGE", "COVERAGE_GAP", "PARTNER_DISPUTE"));
        staff.put("POLICY_CLARIFICATION", List.of("POLICY_QUERY", "APPROVAL_REQUEST"));
        staff.put("SYSTEM_TECHNICAL", List.of("PLATFORM_BUG", "DATA_DISCREPANCY", "ACCESS_PERMISSION_ISSUE"));
        staff.put("OTHER", List.of("GENERAL_QUERY"));
        register("LOCATION_MANAGER", staff);
        register("OPERATIONS_MANAGER", staff);
        register("SUPER_ADMIN", staff);
        register("SUPPORT_STAFF", staff);
    }

    private SupportTicketCategories() {
    }

    public static boolean isValid(String raisedByRole, String category, String subCategory) {
        if (raisedByRole == null || category == null || subCategory == null) {
            return false;
        }
        Map<String, List<String>> categories = BY_ROLE.get(raisedByRole);
        if (categories == null) {
            return false;
        }
        List<String> subCategories = categories.get(category);
        return subCategories != null && subCategories.contains(subCategory);
    }

    public static boolean isKnownRole(String role) {
        return BY_ROLE.containsKey(role);
    }
}
