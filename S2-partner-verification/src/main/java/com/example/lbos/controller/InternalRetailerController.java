package com.example.lbos.controller;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.lbos.dto.RetailerDTO;
import com.example.lbos.service.RetailerService;

/**
 * Service-to-service lookup of retailer data (e.g. S3 resolving which retailer a logged-in
 * partner user owns, or a retailer's public storefront summary). Gated by hasRole("SERVICE")
 * like the other /internal/** endpoints - not for browser/end-user use.
 */
@RestController
@RequestMapping("/internal/v1/retailers")
public class InternalRetailerController {

    public record RetailerContextResponse(
            UUID retailerId, UUID userAccountId, String businessName, UUID cityId, String retailerStatus) {
    }

    /**
     * retailerStatus/zoneId/latitude/longitude were added so customer-facing product listings
     * (S3) can show a "shop details" card (name, verification status, location) without a
     * second round-trip - see S3's ProductResponse.retailerName/retailerStatus/etc fields.
     * There is no rating field on Retailer anywhere in this system (only products have
     * customer ratings) - S3 derives a retailer-level rating separately, from its own
     * CustomerReview data, rather than this service inventing one.
     */
    public record RetailerSummaryResponse(
            UUID retailerId, UUID userAccountId, String businessName, UUID cityId,
            String retailerStatus, UUID zoneId, BigDecimal latitude, BigDecimal longitude) {
    }

    private final RetailerService retailerService;

    public InternalRetailerController(RetailerService retailerService) {
        this.retailerService = retailerService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<RetailerSummaryResponse> get(@PathVariable UUID id) {
        RetailerDTO retailer = retailerService.getRetailerById(id);
        return ResponseEntity.ok(new RetailerSummaryResponse(
                retailer.getRetailerId(), retailer.getUserAccountId(), retailer.getBusinessName(),
                retailer.getCityId(), retailer.getRetailerStatus(), retailer.getZoneId(),
                retailer.getLatitude(), retailer.getLongitude()));
    }

    @GetMapping("/by-user/{userAccountId}")
    public ResponseEntity<RetailerContextResponse> byUser(@PathVariable UUID userAccountId) {
        RetailerDTO retailer = retailerService.getRetailerByUserAccountId(userAccountId);
        return ResponseEntity.ok(new RetailerContextResponse(
                retailer.getRetailerId(), retailer.getUserAccountId(), retailer.getBusinessName(),
                retailer.getCityId(), retailer.getRetailerStatus()));
    }

    /**
     * The retailer ids serviceable in a given zone - lets S3 filter the customer-facing catalogue
     * down to only the shops the customer's own zone can actually be delivered by, rather than
     * showing the whole platform's catalogue and only rejecting at checkout.
     */
    @GetMapping("/by-zone/{zoneId}")
    public ResponseEntity<List<UUID>> retailerIdsByZone(@PathVariable UUID zoneId) {
        List<UUID> ids = retailerService.getVerifiedRetailersByZone(zoneId).stream()
                .map(RetailerDTO::getRetailerId)
                .toList();
        return ResponseEntity.ok(ids);
    }

    /**
     * Retailer ids currently open for orders - lets S3 hide products from a closed store
     * without the customer ever seeing them, rather than showing them and only rejecting at
     * checkout. See RetailerService.getOpenRetailerIds().
     */
    @GetMapping("/open-now")
    public ResponseEntity<List<UUID>> openRetailerIds() {
        return ResponseEntity.ok(retailerService.getOpenRetailerIds());
    }
}
