package com.cbg.lbos.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record TerritoryValidationRequest(UUID cityId, UUID zoneId, String postalCode, BigDecimal latitude, BigDecimal longitude) {
}
