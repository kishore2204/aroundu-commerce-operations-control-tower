package com.cbg.lbos.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.UUID;

/**
 * S5 -> S2 direction, added for the driver/vehicle verification workflow: submits a driver or
 * vehicle into S2's existing VerificationQueue/VerificationDocument machinery - the same
 * document-review process already used for Retailer/FleetOwner onboarding - rather than
 * building new verification infrastructure in S5. Targets S2's real
 * /internal/v1/verification-queues endpoint, gated by the shared HTTP Basic credential (see
 * ServiceBasicAuthFeignConfig). Kept separate from S2PartnerClient (which only ever read
 * fleet-owner validation data) since this is a distinct write operation against a different
 * resource.
 */
@FeignClient(name = "lbos-partner", contextId = "s2VerificationSubmissionClient", configuration = ServiceBasicAuthFeignConfig.class)
public interface S2VerificationSubmissionClient {

    @PostMapping("/internal/v1/verification-queues")
    CreateVerificationQueueResponse submitForVerification(@RequestBody CreateVerificationQueueRequest request);

    record CreateVerificationQueueRequest(String subjectType, UUID subjectId, UUID submittedByAccountId, UUID zoneId) {
    }

    record CreateVerificationQueueResponse(UUID verificationQueueId, String subjectType, UUID subjectId,
                                            String verificationStatus) {
    }
}
