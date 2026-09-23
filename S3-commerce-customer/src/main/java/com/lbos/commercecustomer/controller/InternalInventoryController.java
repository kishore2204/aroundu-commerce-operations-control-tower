package com.lbos.commercecustomer.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import com.lbos.commercecustomer.entity.Product;
import com.lbos.commercecustomer.exception.InsufficientStockException;
import com.lbos.commercecustomer.exception.ResourceNotFoundException;
import com.lbos.commercecustomer.mapper.CommerceMapper;
import com.lbos.commercecustomer.repository.ProductRepository;

/**
 * Service-to-service stock mutation for S4 (Order & Logistics) to atomically deduct stock when
 * an order item is created and restore it when an order is cancelled. Trusted caller only (Basic
 * auth via internalSecurityFilterChain, see SecurityConfig) - not retailer-scoped like the
 * retailer's own StockAdjustmentRequest flow in InventoryServiceImpl, since the caller here is
 * another service acting on behalf of the platform rather than an authenticated retailer.
 */
/*
 * @Transactional at the class level: the @Modifying repository queries this controller calls
 * directly (removeStock/addStock) require a transactional context to execute at all - Spring
 * Data throws InvalidDataAccessApiUsageException otherwise. Confirmed live (500 on every call
 * before this was added). Putting it on the controller rather than a separate service class
 * mirrors this codebase's existing InternalTaxCalculationController-in-S6 precedent of internal
 * endpoints sometimes holding logic directly rather than always delegating to a service.
 */
@RestController
@RequestMapping("/api/v1/internal/products")
@Transactional
public class InternalInventoryController {

    public record StockMutationRequest(@NotNull @Min(1) Integer quantity) { }

    public record StockMutationResponse(Long productId, int stock, String inventoryStatus) { }

    private final ProductRepository productRepository;
    private final CommerceMapper mapper;

    public InternalInventoryController(ProductRepository productRepository, CommerceMapper mapper) {
        this.productRepository = productRepository;
        this.mapper = mapper;
    }

    @PostMapping("/{id}/deduct-stock")
    public ResponseEntity<StockMutationResponse> deductStock(
            @PathVariable Long id, @Valid @RequestBody StockMutationRequest request) {
        int rowsUpdated = productRepository.removeStock(id, request.quantity());
        if (rowsUpdated == 0) {
            // Either the product doesn't exist, or there isn't enough stock. Disambiguate so the
            // error is meaningful, then re-raise the stock failure - that's the common case.
            if (productRepository.findById(id).isEmpty()) {
                throw new ResourceNotFoundException("Product not found: " + id);
            }
            throw new InsufficientStockException("Not enough stock to deduct " + request.quantity()
                    + " unit(s) for product " + id);
        }
        return ResponseEntity.ok(toResponse(id));
    }

    @PostMapping("/{id}/restore-stock")
    public ResponseEntity<StockMutationResponse> restoreStock(
            @PathVariable Long id, @Valid @RequestBody StockMutationRequest request) {
        int rowsUpdated = productRepository.addStock(id, request.quantity());
        if (rowsUpdated == 0) {
            throw new ResourceNotFoundException("Product not found: " + id);
        }
        return ResponseEntity.ok(toResponse(id));
    }

    private StockMutationResponse toResponse(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + id));
        return new StockMutationResponse(
                product.getId(), product.getStock(),
                mapper.inventory(product.getStock(), product.getLowStockThreshold()).name());
    }
}
