package com.cbg.lbos.dto;

import jakarta.validation.constraints.NotBlank;

public record UserAccountStatusRequestDto(@NotBlank String accountStatus) {
}
