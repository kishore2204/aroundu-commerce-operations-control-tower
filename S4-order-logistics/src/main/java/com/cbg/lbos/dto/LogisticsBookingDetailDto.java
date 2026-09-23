package com.cbg.lbos.dto;

import java.math.BigDecimal;
import java.util.UUID;

public class LogisticsBookingDetailDto {

    private Long orderId;
    private UUID vehicleReferenceId;
    private UUID receiverCustomerProfileId;
    private String receiverName;
    private String receiverPhoneNumber;
    private String receiverEmail;
    private String bookingType;
    private String bookingLocationsJson;
    private String specialInstructions;

    // These six fields are used by LogisticsBookingDetailService for cost calculation.
    private BigDecimal estimatedDistanceKm;
    private boolean specialHandlingRequired;
    private boolean priorityDelivery;
    private boolean lastMileDeliveryRequired;
    private BigDecimal estimatedLogisticsCost;

    public Long getOrderId() {
        return orderId;
    }

    public void setOrderId(Long orderId) {
        this.orderId = orderId;
    }

    public UUID getVehicleReferenceId() {
        return vehicleReferenceId;
    }

    public void setVehicleReferenceId(UUID vehicleReferenceId) {
        this.vehicleReferenceId = vehicleReferenceId;
    }

    public UUID getReceiverCustomerProfileId() {
        return receiverCustomerProfileId;
    }

    public void setReceiverCustomerProfileId(UUID receiverCustomerProfileId) {
        this.receiverCustomerProfileId = receiverCustomerProfileId;
    }

    public String getReceiverName() {
        return receiverName;
    }

    public void setReceiverName(String receiverName) {
        this.receiverName = receiverName;
    }

    public String getReceiverPhoneNumber() {
        return receiverPhoneNumber;
    }

    public void setReceiverPhoneNumber(String receiverPhoneNumber) {
        this.receiverPhoneNumber = receiverPhoneNumber;
    }

    public String getReceiverEmail() {
        return receiverEmail;
    }

    public void setReceiverEmail(String receiverEmail) {
        this.receiverEmail = receiverEmail;
    }

    public String getBookingType() {
        return bookingType;
    }

    public void setBookingType(String bookingType) {
        this.bookingType = bookingType;
    }

    public String getBookingLocationsJson() {
        return bookingLocationsJson;
    }

    public void setBookingLocationsJson(String bookingLocationsJson) {
        this.bookingLocationsJson = bookingLocationsJson;
    }

    public String getSpecialInstructions() {
        return specialInstructions;
    }

    public void setSpecialInstructions(String specialInstructions) {
        this.specialInstructions = specialInstructions;
    }

    public BigDecimal getEstimatedDistanceKm() {
        return estimatedDistanceKm;
    }

    public void setEstimatedDistanceKm(BigDecimal estimatedDistanceKm) {
        this.estimatedDistanceKm = estimatedDistanceKm;
    }

    public boolean isSpecialHandlingRequired() {
        return specialHandlingRequired;
    }

    public void setSpecialHandlingRequired(boolean specialHandlingRequired) {
        this.specialHandlingRequired = specialHandlingRequired;
    }

    public boolean isPriorityDelivery() {
        return priorityDelivery;
    }

    public void setPriorityDelivery(boolean priorityDelivery) {
        this.priorityDelivery = priorityDelivery;
    }

    public boolean isLastMileDeliveryRequired() {
        return lastMileDeliveryRequired;
    }

    public void setLastMileDeliveryRequired(boolean lastMileDeliveryRequired) {
        this.lastMileDeliveryRequired = lastMileDeliveryRequired;
    }

    public BigDecimal getEstimatedLogisticsCost() {
        return estimatedLogisticsCost;
    }

    public void setEstimatedLogisticsCost(BigDecimal estimatedLogisticsCost) {
        this.estimatedLogisticsCost = estimatedLogisticsCost;
    }
}
