package com.lbos.finance.dto;

/** The refund's amount/payment-transaction/order-item are set once at request time and never
 *  editable afterward - only the descriptive fields can change, and only while REQUESTED. */
public record CustomerRefundUpdateRequest(String refundReference, String reason) {
}
