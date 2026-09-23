package com.lbos.commercecustomer.controller;

import com.lbos.commercecustomer.dto.response.ApiResponse;
import com.lbos.commercecustomer.dto.response.ProductImageResponse;
import com.lbos.commercecustomer.service.CatalogueService;
import com.lbos.commercecustomer.service.ProductImageStorageService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Optional;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/retailers/me/products")
public class RetailerProductImageController {

    private final CatalogueService catalogueService;
    private final ProductImageStorageService imageStorage;

    public RetailerProductImageController(
            CatalogueService catalogueService, ProductImageStorageService imageStorage) {
        this.catalogueService = catalogueService;
        this.imageStorage = imageStorage;
    }

    @GetMapping("/{productId}/images")
    public ApiResponse<List<ProductImageResponse>> list(
            @PathVariable Long productId, HttpServletRequest request) {
        catalogueService.get(productId); // ownership check
        return ok(request, "Product images retrieved", imageStorage.list(productId));
    }

    @PostMapping(value = "/{productId}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<List<ProductImageResponse>> upload(
            @PathVariable Long productId,
            @RequestPart("files") List<MultipartFile> files,
            HttpServletRequest request) {
        catalogueService.get(productId); // ownership check before writing files
        return ok(request, "Product images uploaded", imageStorage.store(productId, files));
    }

    private <T> ApiResponse<T> ok(HttpServletRequest request, String message, T data) {
        return ApiResponse.of(
                Optional.ofNullable(request.getHeader("X-Correlation-Id")).orElse("not-provided"),
                message,
                data);
    }
}
