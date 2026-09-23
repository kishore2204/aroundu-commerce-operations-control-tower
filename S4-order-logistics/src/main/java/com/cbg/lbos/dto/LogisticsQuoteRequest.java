package com.cbg.lbos.dto;

import java.math.BigDecimal;

/** What the price of a logistics booking depends on - see LogisticsBookingDetailService#quote. An extra that is left out is "no". */
public record LogisticsQuoteRequest(String bookingType, BigDecimal estimatedDistanceKm, Boolean specialHandlingRequired,
        Boolean priorityDelivery, Boolean lastMileDeliveryRequired) { }
