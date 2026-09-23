package com.lbos.finance.integration.dto;
import java.util.UUID;

/**
 * S6-local mirror of the customer service-area (city/zone) shape returned by the commerce
 * service's internal API. Used by the support-ticket clustering sweep to give a ticket a
 * territory, since SupportTicket itself carries no zone or city of its own.
 *
 * @param customerProfileId the customer profile id
 * @param cityId the city of the customer's default (or first saved) address, or {@code null}
 *        if the customer has no usable saved address
 * @param zoneId the zone of that same address, or {@code null} if no zone is assigned
 */
public record CustomerServiceAreaResponse(UUID customerProfileId, UUID cityId, UUID zoneId) { }
