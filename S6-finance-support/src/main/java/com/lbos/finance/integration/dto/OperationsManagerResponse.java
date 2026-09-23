package com.lbos.finance.integration.dto;
import java.util.UUID;
public record OperationsManagerResponse(UUID operationsManagerId, UUID userAccountId, UUID cityId, String assignmentStatus) { }
