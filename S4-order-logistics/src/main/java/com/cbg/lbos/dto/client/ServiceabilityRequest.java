package com.cbg.lbos.dto.client;

import java.util.List;
import java.util.UUID;

public record ServiceabilityRequest(
        UUID customerProfileId,
        UUID addressId,
        UUID cityId,
        UUID zoneId,
        List<Long> productIds) {
}
