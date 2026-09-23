package com.lbos.finance.dto;
import java.math.BigDecimal;
import java.time.LocalDate;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
/*
 * All four fields are dereferenced unconditionally in CustomerInvoiceServiceImpl (orderId is
 * passed straight into a Feign @PathVariable call to S4; taxAmount is added to a BigDecimal
 * with no null check). Previously unvalidated, so a request missing orderId serialized as a
 * blank Feign path segment ("GET .../internal/orders/", no id) - S4 500'd on the malformed
 * call, which this service correctly translated to a clean-looking but misleading 503
 * "dependent service unavailable" for what was actually a client input problem. Confirmed
 * live: PUT /api/customer-invoices/{id} with just {"invoiceStatus":"PAID"} (no orderId) 503'd.
 */
public record CustomerInvoiceRequest(
        @NotNull(message = "orderId is required") Long orderId,
        @NotBlank(message = "invoiceNumber is required") String invoiceNumber,
        @NotNull(message = "invoiceDate is required") LocalDate invoiceDate,
        @NotNull(message = "taxAmount is required") BigDecimal taxAmount) { }
