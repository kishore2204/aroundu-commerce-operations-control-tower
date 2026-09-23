package com.cbg.lbos.dto;

/**
 * Request body for the internal "a partner was suspended" callbacks
 * ({@code POST /api/v1/internal/partners/retailers/{retailerId}/suspended} and
 * {@code .../fleet-owners/{fleetOwnerId}/suspended}), called by S2 once an Operations/Location
 * Manager suspends a retailer or fleet owner.
 *
 * @param reason the operator-supplied suspension reason, recorded on every order this
 *               suspension cancels; may be {@code null}, in which case S4 records a generic
 *               "suspended by Operations Manager" reason instead
 */
public record PartnerSuspensionRequest(String reason) {
}
