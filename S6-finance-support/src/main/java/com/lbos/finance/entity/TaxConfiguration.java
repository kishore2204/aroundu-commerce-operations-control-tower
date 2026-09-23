package com.lbos.finance.entity;
import java.util.UUID;
import java.math.BigDecimal;
import java.time.LocalDate;
import jakarta.persistence.*;
@Entity
@Table(name = "tax_configuration")
public class TaxConfiguration {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID taxConfigurationId;
    /** The S3 product category this rate applies to - a cross-service reference by id only (no JPA relation, no copy
     *  of the category table). Null only on legacy rows that have not been linked to a category yet. */
    private Long productCategoryId;
    /** Display snapshot of the category name (and the original free-text name of legacy rows). Not authoritative: the
     *  rate is found through productCategoryId. */
    private String taxCategoryName;
    private String description;
    private UUID stateId;
    private BigDecimal cgst;
    private BigDecimal sgst;
    private LocalDate effectiveFrom;
    private LocalDate effectiveTo;
    private Boolean active;
    public UUID getTaxConfigurationId() { return taxConfigurationId; }
    public void setTaxConfigurationId(UUID taxConfigurationId) { this.taxConfigurationId = taxConfigurationId; }
    public Long getProductCategoryId() { return productCategoryId; }
    public void setProductCategoryId(Long productCategoryId) { this.productCategoryId = productCategoryId; }
    public String getTaxCategoryName() { return taxCategoryName; }
    public void setTaxCategoryName(String taxCategoryName) { this.taxCategoryName = taxCategoryName; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public UUID getStateId() { return stateId; }
    public void setStateId(UUID stateId) { this.stateId = stateId; }
    public BigDecimal getCgst() { return cgst; }
    public void setCgst(BigDecimal cgst) { this.cgst = cgst; }
    public BigDecimal getSgst() { return sgst; }
    public void setSgst(BigDecimal sgst) { this.sgst = sgst; }
    public LocalDate getEffectiveFrom() { return effectiveFrom; }
    public void setEffectiveFrom(LocalDate effectiveFrom) { this.effectiveFrom = effectiveFrom; }
    public LocalDate getEffectiveTo() { return effectiveTo; }
    public void setEffectiveTo(LocalDate effectiveTo) { this.effectiveTo = effectiveTo; }
    public Boolean isActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
}
