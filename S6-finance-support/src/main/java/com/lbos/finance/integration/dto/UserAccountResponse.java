package com.lbos.finance.integration.dto;
import java.util.UUID;
public record UserAccountResponse(UUID userAccountId, String email, String phoneNumber, String firstName, String lastName, String role, String accountStatus) { }
