package com.lbos.commercecustomer.controller;

import com.lbos.commercecustomer.service.CategoryService;
import com.lbos.commercecustomer.service.CategoryService.CategoryResolution;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Service-to-service only ({@code /api/v1/internal/**} sits behind the shared HTTP Basic credential, like
 * {@link InternalCustomerController}). S3 stays the owner of {@code ProductCategory}: S6's "new tax rule" flow asks
 * S3 to find the category the admin typed - or create it - and gets the category id back to store on the tax rule.
 */
@RestController
@RequestMapping("/api/v1/internal/product-categories")
public class InternalCategoryController {

    public record ResolveRequest(String name, boolean createIfMissing) { }

    private final CategoryService categoryService;

    public InternalCategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @PostMapping("/resolve")
    public ResponseEntity<CategoryResolution> resolve(@RequestBody ResolveRequest request) {
        return ResponseEntity.ok(categoryService.resolveByName(request.name(), request.createIfMissing()));
    }
}
