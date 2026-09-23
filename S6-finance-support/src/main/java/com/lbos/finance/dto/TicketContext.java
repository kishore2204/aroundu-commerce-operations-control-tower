package com.lbos.finance.dto;

import java.util.List;

import com.lbos.finance.integration.dto.CustomerProfileResponse;
import com.lbos.finance.integration.dto.OrderItemResponse;
import com.lbos.finance.integration.dto.OrderResponse;
import com.lbos.finance.integration.dto.TripResponse;

/**
 * Consolidated read-only context for a support ticket's linked order, so an agent (or an
 * escalation-target retailer/fleet owner) never has to jump between screens - order status/
 * items, the delivery trip (if any), and the raising customer's profile, each independently
 * best-effort (a ticket may have no orderId, no trip yet, or no customerProfileId).
 */
public record TicketContext(OrderResponse order, List<OrderItemResponse> items, TripResponse trip, CustomerProfileResponse customer, String retailerBusinessName, String fleetOwnerBusinessName) { }
