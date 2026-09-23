package com.lbos.commercecustomer.dto.client.partner; import java.util.*;import java.math.*;import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
/** S3-local mirror of S2's InternalRetailerController.RetailerSummaryResponse - kept
 * field-for-field in sync. ignoreUnknown so S2 can add fields this client doesn't yet read
 * without breaking deserialization, matching S4's established mirror-DTO convention. */
@JsonIgnoreProperties(ignoreUnknown=true)
public record RetailerSummaryResponse(UUID retailerId,String businessName,UUID cityId,String retailerStatus,UUID zoneId,BigDecimal latitude,BigDecimal longitude) {}
