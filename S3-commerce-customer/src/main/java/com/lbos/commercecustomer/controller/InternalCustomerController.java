package com.lbos.commercecustomer.controller;

import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.lbos.commercecustomer.entity.CustomerAddress;
import com.lbos.commercecustomer.entity.CustomerProfile;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import com.lbos.commercecustomer.exception.ResourceNotFoundException;
import com.lbos.commercecustomer.repository.CustomerAddressRepository;
import com.lbos.commercecustomer.repository.CustomerProfileRepository;

@RestController
@RequestMapping("/api/v1/internal/customers")
public class InternalCustomerController {
    public record CustomerProfileInternalResponse(
            UUID customerProfileId, UUID userAccountId,
            String profileStatus, BigDecimal rewardPointsBalance) { }

    /** S6's support-ticket clustering sweep resolves a ticket's territory through this - the
     *  customer's default saved address, falling back to their oldest one. Null ids (not a 404)
     *  when the customer has no usable address, since "no territory" is a legitimate outcome. */
    public record CustomerServiceAreaInternalResponse(UUID customerProfileId, UUID cityId, UUID zoneId) { }

    private final CustomerProfileRepository customerProfileRepository;
    private final CustomerAddressRepository customerAddressRepository;
    public InternalCustomerController(
            CustomerProfileRepository customerProfileRepository,
            CustomerAddressRepository customerAddressRepository) {
        this.customerProfileRepository = customerProfileRepository;
        this.customerAddressRepository = customerAddressRepository;
    }

    @GetMapping("/{customerProfileId}")
    public ResponseEntity<CustomerProfileInternalResponse> getCustomerProfile(
            @PathVariable UUID customerProfileId) {
        CustomerProfile customerProfile = customerProfileRepository.findById(customerProfileId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Customer profile not found: " + customerProfileId));
        return ResponseEntity.ok(new CustomerProfileInternalResponse(
                customerProfile.getId(),
                customerProfile.getUserAccountId(),
                customerProfile.getProfileStatus(),
                customerProfile.getRewardPointsBalance()));
    }

    @GetMapping("/{customerProfileId}/service-area")
    public ResponseEntity<CustomerServiceAreaInternalResponse> getServiceArea(
            @PathVariable UUID customerProfileId) {
        Optional<CustomerAddress> address = customerAddressRepository
                .findByCustomerIdAndDefaultAddressTrue(customerProfileId);
        if (address.isEmpty()) {
            List<CustomerAddress> all = customerAddressRepository.findByCustomerIdOrderByIdAsc(customerProfileId);
            address = all.isEmpty() ? Optional.empty() : Optional.of(all.get(0));
        }
        UUID cityId = address.map(CustomerAddress::getCityId).orElse(null);
        UUID zoneId = address.map(CustomerAddress::getZoneId).orElse(null);
        return ResponseEntity.ok(new CustomerServiceAreaInternalResponse(customerProfileId, cityId, zoneId));
    }
}
