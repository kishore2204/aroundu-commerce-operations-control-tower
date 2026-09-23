package com.lbos.finance.integration.dto;
import java.util.UUID;
public record StateResponse(UUID stateId, String stateName, String countryCode, Boolean active) { }
