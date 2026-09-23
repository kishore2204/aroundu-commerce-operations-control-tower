package com.lbos.commercecustomer.dto.request; import java.util.UUID;import jakarta.validation.constraints.*;
public record CartServiceabilityRequest(@NotNull UUID addressId) {}
