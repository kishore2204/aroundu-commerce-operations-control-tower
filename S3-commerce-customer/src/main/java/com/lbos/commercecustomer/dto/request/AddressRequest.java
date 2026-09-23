package com.lbos.commercecustomer.dto.request; import java.util.UUID;import java.time.LocalDate;import java.math.BigDecimal;import jakarta.validation.constraints.*;import com.lbos.commercecustomer.enums.StockAdjustmentType; 
/*
##################################################################

                                           TK_INC0010079_Postal_Code_Validation_3248237

#####################################################################
*/
public record AddressRequest(@NotBlank String cityName, @NotBlank String zoneName, @NotBlank @Size(max=30) String addressTag, @NotBlank @Size(max=255) String line1, @Size(max=255) String line2, @Pattern(regexp="^$|^[0-9]{6}$", message="Postal code must be exactly 6 digits") String postalCode, @Digits(integer=3,fraction=7) BigDecimal latitude, @Digits(integer=3,fraction=7) BigDecimal longitude, boolean defaultAddress) {}