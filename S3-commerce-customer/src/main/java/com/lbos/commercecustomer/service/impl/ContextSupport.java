package com.lbos.commercecustomer.service.impl;

import java.util.UUID;

import org.springframework.stereotype.Component;

import com.lbos.commercecustomer.client.PartnerVerificationClient;
import com.lbos.commercecustomer.context.AuthenticatedUserProvider;
import com.lbos.commercecustomer.dto.client.partner.RetailerContextResponse;
import com.lbos.commercecustomer.entity.CustomerProfile;
import com.lbos.commercecustomer.exception.ResourceNotFoundException;
import com.lbos.commercecustomer.repository.CustomerProfileRepository;

@Component
public class ContextSupport {

    private final AuthenticatedUserProvider authenticatedUserProvider;
    private final CustomerProfileRepository customerProfileRepository;
    private final PartnerVerificationClient partnerVerificationClient;
    private final FeignCallSupport feignCallSupport;

    public ContextSupport(
            AuthenticatedUserProvider authenticatedUserProvider,
            CustomerProfileRepository customerProfileRepository,
            PartnerVerificationClient partnerVerificationClient,
            FeignCallSupport feignCallSupport) {
        this.authenticatedUserProvider = authenticatedUserProvider;
        this.customerProfileRepository = customerProfileRepository;
        this.partnerVerificationClient = partnerVerificationClient;
        this.feignCallSupport = feignCallSupport;
    }

    public UUID currentUserAccountId() {
        return authenticatedUserProvider.currentUserAccountId();
    }

    public CustomerProfile customer() {
        UUID userAccountId = authenticatedUserProvider.currentUserAccountId();
        return customerProfileRepository.findByUserAccountId(userAccountId)
                .orElseGet(() -> {
                    CustomerProfile customerProfile = new CustomerProfile();
                    customerProfile.setUserAccountId(userAccountId);
                    return customerProfileRepository.save(customerProfile);
                });
    }

    public RetailerContextResponse retailer() {
        UUID userAccountId = authenticatedUserProvider.currentUserAccountId();
        RetailerContextResponse retailerContext =
                feignCallSupport.call("lbos-partner", () -> partnerVerificationClient.byUser(userAccountId));

        if (retailerContext == null || retailerContext.retailerId() == null) {
            throw new ResourceNotFoundException("Retailer profile not found");
        }

        return retailerContext;
    }
}
