package com.cbg.lbos.dto;

import com.cbg.lbos.client.dto.CustomerSummary;
import com.cbg.lbos.client.dto.ProductSummary;
import com.cbg.lbos.client.dto.RetailerSummary;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public class OrderItemDto {

    private Long id;

    @NotNull(message = "Order ID is required")
    private Long orderId;

    @NotNull(message = "Retailer ID is required")
    private UUID retailerId;

    @NotNull(message = "Product ID is required")
    private Long productId;

    /* skuSnapshot/productNameSnapshot/unitPrice/lineTotal are always derived
     * server-side from the live product record (see OrderItemService) - not
     * client-writable input, so they're not required on a request body.
     * Still present on the DTO since it doubles as the response shape. */
    @Size(max = 80, message = "SKU snapshot cannot exceed 80 characters")
    private String skuSnapshot;

    @Size(max = 200, message = "Product name snapshot cannot exceed 200 characters")
    private String productNameSnapshot;

    @NotNull(message = "Quantity is required")
    @Min(value = 1, message = "Quantity must be at least 1")
    private Integer quantity;

    @DecimalMin(value = "0.00", message = "Unit price cannot be negative")
    @Digits(integer = 10, fraction = 2)
    private BigDecimal unitPrice;

    @DecimalMin(value = "0.00", message = "Discount amount cannot be negative")
    @Digits(integer = 10, fraction = 2)
    private BigDecimal discountAmount;

    @DecimalMin(value = "0.00", message = "Line total cannot be negative")
    @Digits(integer = 10, fraction = 2)
    private BigDecimal lineTotal;

    /*
     * The fields below are read-only enrichment, fetched live via Feign at toDto() time
     * (see OrderItemService.toDto()) - never client-writable input, and never persisted.
     * deliveryAddress is the exception in that it needs no Feign call: it is copied
     * straight off the parent Order's own already-loaded deliveryAddress snapshot.
     */
    private ProductSummary product;
    private RetailerSummary retailer;
    private CustomerSummary customer;
    private String deliveryAddress;

    public OrderItemDto() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public UUID getRetailerId() { return retailerId; }
    public void setRetailerId(UUID retailerId) { this.retailerId = retailerId; }
    public Long getProductId() { return productId; }
    public void setProductId(Long productId) { this.productId = productId; }
    public String getSkuSnapshot() { return skuSnapshot; }
    public void setSkuSnapshot(String skuSnapshot) { this.skuSnapshot = skuSnapshot; }
    public String getProductNameSnapshot() { return productNameSnapshot; }
    public void setProductNameSnapshot(String productNameSnapshot) { this.productNameSnapshot = productNameSnapshot; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }
    public BigDecimal getDiscountAmount() { return discountAmount; }
    public void setDiscountAmount(BigDecimal discountAmount) { this.discountAmount = discountAmount; }
    public BigDecimal getLineTotal() { return lineTotal; }
    public void setLineTotal(BigDecimal lineTotal) { this.lineTotal = lineTotal; }
    public ProductSummary getProduct() { return product; }
    public void setProduct(ProductSummary product) { this.product = product; }
    public RetailerSummary getRetailer() { return retailer; }
    public void setRetailer(RetailerSummary retailer) { this.retailer = retailer; }
    public CustomerSummary getCustomer() { return customer; }
    public void setCustomer(CustomerSummary customer) { this.customer = customer; }
    public String getDeliveryAddress() { return deliveryAddress; }
    public void setDeliveryAddress(String deliveryAddress) { this.deliveryAddress = deliveryAddress; }
}
