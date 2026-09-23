package com.lbos.commercecustomer.dto.response; import java.util.List; public record CartValidationResponse(CartResponse cart,boolean valid,List<CartValidationIssue> issues) {}
