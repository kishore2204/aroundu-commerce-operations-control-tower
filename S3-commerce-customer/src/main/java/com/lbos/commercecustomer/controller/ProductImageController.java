package com.lbos.commercecustomer.controller;

import com.lbos.commercecustomer.dto.response.ApiResponse;
import com.lbos.commercecustomer.dto.response.ProductImageResponse;
import com.lbos.commercecustomer.service.ProductImageStorageService;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Optional;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/products")
public class ProductImageController {

    private final ProductImageStorageService imageStorage;

    public ProductImageController(ProductImageStorageService imageStorage) {
        this.imageStorage = imageStorage;
    }

    @SecurityRequirements
    @GetMapping("/{productId}/images")
    public ApiResponse<List<ProductImageResponse>> list(
            @PathVariable Long productId, HttpServletRequest request) {
        return ApiResponse.of(
                Optional.ofNullable(request.getHeader("X-Correlation-Id")).orElse("not-provided"),
                "Product images retrieved",
                imageStorage.list(productId));
    }

    @SecurityRequirements
    @GetMapping("/{productId}/images/{fileName:.+}")
    public ResponseEntity<Resource> file(
            @PathVariable Long productId, @PathVariable String fileName) {
        Resource resource = imageStorage.load(productId, fileName);
        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(imageStorage.contentType(productId, fileName));
        } catch (Exception ignored) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=3600")
                .contentType(mediaType)
                .body(resource);
    }
}
