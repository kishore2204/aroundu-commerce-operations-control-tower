package com.lbos.finance.dto;

/** Amounts are fixed at creation time (and validated against the payment transaction); only
 *  the reference/date can change afterward, and only while PENDING. */
public record SettlementUpdateRequest(String settlementReference, java.time.LocalDate settlementDate) {
}
