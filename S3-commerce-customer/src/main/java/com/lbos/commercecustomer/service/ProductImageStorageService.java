package com.lbos.commercecustomer.service;

import com.lbos.commercecustomer.dto.response.ProductImageResponse;
import com.lbos.commercecustomer.exception.BusinessValidationException;
import com.lbos.commercecustomer.exception.ResourceNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ProductImageStorageService {

    private static final long MAX_IMAGE_BYTES = 8L * 1024L * 1024L;
    private static final int MAX_IMAGES_PER_PRODUCT = 8;
    private static final Map<String, String> CONTENT_TYPE_EXTENSIONS = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp",
            "image/gif", ".gif");

    private final Path storageRoot;

    public ProductImageStorageService(
            @Value("${product.images.storage-dir:./data/product-images}") String storageDirectory) {
        this.storageRoot = Path.of(storageDirectory).toAbsolutePath().normalize();
    }

    public synchronized List<ProductImageResponse> store(Long productId, List<MultipartFile> files) {
        if (files == null || files.isEmpty()) {
            throw new BusinessValidationException("Select at least one product image");
        }
        List<ProductImageResponse> existing = list(productId);
        if (existing.size() + files.size() > MAX_IMAGES_PER_PRODUCT) {
            throw new BusinessValidationException("A product can have at most " + MAX_IMAGES_PER_PRODUCT + " images");
        }

        Path productDirectory = productDirectory(productId);
        try {
            Files.createDirectories(productDirectory);
            int nextOrder = existing.size() + 1;
            for (MultipartFile file : files) {
                validate(file);
                String contentType = file.getContentType().toLowerCase(Locale.ROOT);
                String extension = CONTENT_TYPE_EXTENSIONS.get(contentType);
                String storedName = String.format("%04d-%s%s", nextOrder++, UUID.randomUUID(), extension);
                Path target = productDirectory.resolve(storedName).normalize();
                try (InputStream input = file.getInputStream()) {
                    Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
                }
            }
            return list(productId);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not store product image", exception);
        }
    }

    public List<ProductImageResponse> list(Long productId) {
        Path directory = productDirectory(productId);
        if (!Files.isDirectory(directory)) {
            return List.of();
        }
        try (var paths = Files.list(directory)) {
            List<Path> imagePaths = paths
                    .filter(Files::isRegularFile)
                    .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                    .toList();
            List<ProductImageResponse> result = new ArrayList<>();
            for (int index = 0; index < imagePaths.size(); index++) {
                String fileName = imagePaths.get(index).getFileName().toString();
                result.add(new ProductImageResponse(
                        fileName,
                        "/api/v1/products/" + productId + "/images/" + fileName,
                        index == 0));
            }
            return result;
        } catch (IOException exception) {
            throw new IllegalStateException("Could not list product images", exception);
        }
    }

    public Resource load(Long productId, String fileName) {
        if (fileName == null || fileName.isBlank() || fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
            throw new ResourceNotFoundException("Product image not found");
        }
        Path directory = productDirectory(productId);
        Path file = directory.resolve(fileName).normalize();
        if (!file.startsWith(directory) || !Files.isRegularFile(file)) {
            throw new ResourceNotFoundException("Product image not found");
        }
        try {
            return new UrlResource(file.toUri());
        } catch (Exception exception) {
            throw new ResourceNotFoundException("Product image not found");
        }
    }

    public String contentType(Long productId, String fileName) {
        Path file = productDirectory(productId).resolve(fileName).normalize();
        try {
            String type = Files.probeContentType(file);
            return type == null ? "application/octet-stream" : type;
        } catch (IOException exception) {
            return "application/octet-stream";
        }
    }

    private Path productDirectory(Long productId) {
        if (productId == null || productId <= 0) {
            throw new BusinessValidationException("A valid product id is required");
        }
        return storageRoot.resolve(String.valueOf(productId)).normalize();
    }

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessValidationException("Product image cannot be empty");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new BusinessValidationException("Each product image must be 8 MB or smaller");
        }
        String contentType = file.getContentType();
        if (contentType == null || !CONTENT_TYPE_EXTENSIONS.containsKey(contentType.toLowerCase(Locale.ROOT))) {
            throw new BusinessValidationException("Only JPG, PNG, WEBP and GIF product images are supported");
        }
    }
}
