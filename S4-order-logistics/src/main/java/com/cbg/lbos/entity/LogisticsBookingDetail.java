package com.cbg.lbos.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;

@Entity
@Table(name = "logistics_booking_detail")
public class LogisticsBookingDetail {

    @Id
    @Column(name = "order_id")
    private Long id;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
        name = "order_id",
        nullable = false,
        unique = true
    )
    private Order order;

    /*
     * vehicle is owned by S5 (lbos-fleet) and customer_profile by S3
     * (lbos-commerce). Both are stored as plain scalar FKs.
     */
    @Column(name = "vehicle_reference_id")
    private UUID vehicleReferenceId;

    @Column(name = "receiver_customer_profile_id")
    private UUID receiverCustomerProfileId;

    @Column(name = "receiver_name", nullable = false, length = 150)
    private String receiverName;

    @Column(name = "receiver_phone_number", nullable = false, length = 30)
    private String receiverPhoneNumber;

    @Column(name = "receiver_email", length = 255)
    private String receiverEmail;

    @Column(name = "booking_type", nullable = false, length = 40)
    private String bookingType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(
        name = "booking_locations_json",
        nullable = false
    )
    private String bookingLocationsJson = "[]";

    @Column(name = "special_instructions", columnDefinition = "text")
    private String specialInstructions;

    public LogisticsBookingDetail() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Order getOrder() {
        return order;
    }

    public void setOrder(Order order) {
        this.order = order;
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

    public void setReceiverCustomerProfileId(
            UUID receiverCustomerProfileId) {
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
}