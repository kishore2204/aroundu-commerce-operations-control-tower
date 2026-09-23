package com.lbos.finance.integration.dto;
import java.util.UUID;
import java.math.BigDecimal;
public record CustomerProfileResponse(UUID customerProfileId, UUID userAccountId, String profileStatus, BigDecimal rewardPointsBalance) { }
