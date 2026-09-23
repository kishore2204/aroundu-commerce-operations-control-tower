package com.cbg.lbos.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * Indexed on {@code order_id} (the FK behind every findByOrder_Id/findByOrder_IdIn - the batched
 * lookup used by every order list/detail screen; PostgreSQL does not index FK columns
 * automatically) and {@code retailer_id} (findDistinctOrderIdsByRetailerId, the retailer's own
 * order-list lookup).
 */
@Entity
@Table(name = "order_item", indexes = {
        @Index(name = "idx_order_item_order_id", columnList = "order_id"),
        @Index(name = "idx_order_item_retailer_id", columnList = "retailer_id"),
})
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_item_id")
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;
    /*
     * retailer is owned by S2 and product by S3 (lbos-commerce).
     * Both are stored as plain scalar FKs, never JPA relationships.
     */
    @Column(name = "retailer_id", nullable = false)
    private UUID retailerId;
    @Column(name = "product_id", nullable = false)
    private Long productId;
    @Column(name = "sku_snapshot", nullable = false)
    private String skuSnapshot;
    @Column(name = "product_name_snapshot", nullable = false)
    private String productNameSnapshot;
    @Column(name = "quantity", nullable = false)
    private Integer quantity;
    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;
    @Column(name = "discount_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal discountAmount;
    @Column(name = "line_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal lineTotal;
    /*
     * Set true once OrderService's CANCELLED-transition branch has successfully restored this
     * line's stock in S3 via InventoryClient.restoreStock(). Defense-in-depth against a double
     * restore: the primary safeguard is that the CANCELLED branch itself only fires once per
     * order (a repeated cancel attempt is a same-status no-op under validateStatusTransition()).
     */
    @Column(name = "stock_restored", nullable = false)
    private boolean stockRestored = false;

    /**
     * Weight of ONE unit in kg, snapshotted from the product when the line is written. NULL (lines
     * created before weights existed, or a product with no stored weight) counts as 1 kg - see
     * {@link #effectiveWeightKg()}.
     */
    @Column(name = "weight_kg_snapshot", precision = 10, scale = 3)
    private BigDecimal weightKgSnapshot;

    public OrderItem() {
    }

    public BigDecimal getWeightKgSnapshot() {
        return weightKgSnapshot;
    }

    public void setWeightKgSnapshot(BigDecimal weightKgSnapshot) {
        this.weightKgSnapshot = weightKgSnapshot;
    }

    /** Per-unit weight to use in calculations: the snapshot, or 1 kg when none was recorded. */
    public BigDecimal effectiveWeightKg() {
        return weightKgSnapshot == null ? BigDecimal.ONE : weightKgSnapshot;
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

    public UUID getRetailerId() {
        return retailerId;
    }

    public void setRetailerId(UUID retailerId) {
        this.retailerId = retailerId;
    }

    public Long getProductId() {
        return productId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public String getSkuSnapshot() {
        return skuSnapshot;
    }

    public void setSkuSnapshot(String skuSnapshot) {
        this.skuSnapshot = skuSnapshot;
    }

    public String getProductNameSnapshot() {
        return productNameSnapshot;
    }

    public void setProductNameSnapshot(String productNameSnapshot) {
        this.productNameSnapshot = productNameSnapshot;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(BigDecimal unitPrice) {
        this.unitPrice = unitPrice;
    }

    public BigDecimal getDiscountAmount() {
        return discountAmount;
    }

    public void setDiscountAmount(BigDecimal discountAmount) {
        this.discountAmount = discountAmount;
    }

    public BigDecimal getLineTotal() {
        return lineTotal;
    }

    public void setLineTotal(BigDecimal lineTotal) {
        this.lineTotal = lineTotal;
    }

    public boolean isStockRestored() {
        return stockRestored;
    }

    public void setStockRestored(boolean stockRestored) {
        this.stockRestored = stockRestored;
    }

}
