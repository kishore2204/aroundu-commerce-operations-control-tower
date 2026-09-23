package com.lbos.commercecustomer.repository;

import com.lbos.commercecustomer.entity.Product;
import com.lbos.commercecustomer.enums.InventoryStatus;
import com.lbos.commercecustomer.enums.ProductStatus;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

/**
 * DB-level WHERE-clause building blocks for Product search/browse queries. Replaces the
 * previous pattern of paginating first (repo.findAll/findByRetailerId(PageRequest)) and then
 * filtering the resulting page in memory, which made totalElements/totalPages reflect the
 * unfiltered table and could hide matches that fell outside the current unfiltered page.
 */
public final class ProductSpecifications {

    private ProductSpecifications() {
    }

    public static Specification<Product> retailerId(UUID retailerId) {
        return (root, query, cb) -> retailerId == null ? null : cb.equal(root.get("retailerId"), retailerId);
    }

    /** Backs the batch product-lookup endpoint (checkout serviceability's product IN clause). */
    public static Specification<Product> idIn(java.util.Collection<Long> ids) {
        return (root, query, cb) -> ids == null ? null : root.get("id").in(ids);
    }

    /** Zone-based catalogue filter: only products from retailers serviceable in the customer's
     *  zone - see ProductDiscoveryServiceImpl.search(). An empty (non-null) set means the zone
     *  has no serviceable retailers at all, so this must still filter everything out rather than
     *  being treated as "no filter" the way a null retailerId set is. */
    public static Specification<Product> retailerIdIn(java.util.List<UUID> retailerIds) {
        return (root, query, cb) -> retailerIds == null ? null : root.get("retailerId").in(retailerIds);
    }

    /**
     * Loads each product's category in the same query as the page. The response mapper reads the
     * category id and name for every product, which otherwise costs one extra select per distinct
     * category on the page. Skipped for the count query Spring Data issues for pagination.
     */
    public static Specification<Product> fetchCategory() {
        return (root, query, cb) -> {
            if (query != null && !Long.class.equals(query.getResultType()) && !long.class.equals(query.getResultType())) {
                root.fetch("category", jakarta.persistence.criteria.JoinType.INNER);
            }
            return null;
        };
    }

    public static Specification<Product> status(ProductStatus status) {
        return (root, query, cb) -> status == null ? null : cb.equal(root.get("status"), status);
    }

    public static Specification<Product> categoryId(Long categoryId) {
        return (root, query, cb) -> categoryId == null ? null : cb.equal(root.get("category").get("id"), categoryId);
    }

    /** Matches against name or SKU only (used by the retailer catalogue/inventory search box). */
    public static Specification<Product> nameOrSkuContains(String q) {
        return (root, query, cb) -> {
            if (q == null || q.isBlank()) return null;
            String like = "%" + q.toLowerCase() + "%";
            return cb.or(cb.like(cb.lower(root.get("name")), like), cb.like(cb.lower(root.get("sku")), like));
        };
    }

    /** Matches against name, SKU or description (used by the public product discovery search box). */
    public static Specification<Product> nameOrSkuOrDescriptionContains(String q) {
        return (root, query, cb) -> {
            if (q == null || q.isBlank()) return null;
            String like = "%" + q.toLowerCase() + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("name")), like),
                    cb.like(cb.lower(root.get("sku")), like),
                    cb.like(cb.lower(root.get("description")), like));
        };
    }

    public static Specification<Product> inStock(Boolean inStock) {
        return (root, query, cb) -> (inStock == null || !inStock) ? null : cb.greaterThan(root.get("stock"), 0);
    }

    /**
     * Mirrors CommerceMapper.inventory(): OUT_OF_STOCK when stock is 0, LOW_STOCK when stock is
     * at or under the effective threshold (the product's own lowStockThreshold, defaulting to
     * 10), HEALTHY otherwise. Expressed as a WHERE predicate (CASE-equivalent comparison against
     * stock/lowStockThreshold) so filtering by inventory status happens at the DB level instead
     * of after fetching every row.
     */
    public static Specification<Product> inventoryStatus(InventoryStatus inventoryStatus) {
        return (root, query, cb) -> {
            if (inventoryStatus == null) return null;
            var threshold = cb.coalesce(root.<Integer>get("lowStockThreshold"), 10);
            var stock = root.<Integer>get("stock");
            return switch (inventoryStatus) {
                case OUT_OF_STOCK -> cb.equal(stock, 0);
                case LOW_STOCK -> cb.and(cb.notEqual(stock, 0), cb.lessThanOrEqualTo(stock, threshold));
                case HEALTHY -> cb.greaterThan(stock, threshold);
            };
        };
    }
}
