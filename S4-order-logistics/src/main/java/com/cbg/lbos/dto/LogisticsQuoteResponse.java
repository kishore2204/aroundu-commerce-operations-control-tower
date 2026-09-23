package com.cbg.lbos.dto;

import java.math.BigDecimal;

/** The logistics charge and the total the customer pays - the two figures the order stores (deliveryCharge / totalAmount). */
public record LogisticsQuoteResponse(BigDecimal logisticsCharge, BigDecimal totalAmount) { }
