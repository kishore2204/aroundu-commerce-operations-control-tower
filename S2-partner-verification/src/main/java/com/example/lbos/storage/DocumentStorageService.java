package com.example.lbos.storage;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import com.example.lbos.exception.InvalidDocumentFileException;

/**
 * Validates uploaded verification document files (PDF/JPG/JPEG/PNG) and returns their
 * content in memory for the caller to persist as a BLOB, instead of writing anything to
 * local disk. Filenames are generated (never the caller-supplied original name) to avoid
 * collisions and to keep naming consistent regardless of what the client uploaded.
 */
@Component
public class DocumentStorageService {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("pdf", "jpg", "jpeg", "png");

    private static final Map<String, Set<String>> ALLOWED_CONTENT_TYPES_BY_EXTENSION = Map.of(
            "pdf", Set.of("application/pdf"),
            "jpg", Set.of("image/jpeg"),
            "jpeg", Set.of("image/jpeg"),
            "png", Set.of("image/png"));

    private final long maxFileSizeBytes;

    public DocumentStorageService(
            @Value("${app.storage.documents-max-file-size-bytes:10485760}") long maxFileSizeBytes) {
        this.maxFileSizeBytes = maxFileSizeBytes;
    }

    /**
     * Validates the given multipart file and reads its content into memory, returning a
     * {@link StoredDocument} to persist in {@code VerificationDocument.fileContent} (plus
     * its metadata fields). The returned file name is a generated UUID+extension name (not
     * the caller-supplied original name), matching the naming scheme previously used for
     * files written to disk.
     *
     * @throws InvalidDocumentFileException if the file is empty, oversized, or not one of the
     *         allowed types (PDF/JPG/JPEG/PNG), checked by both extension and content-type.
     */
    public StoredDocument store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new InvalidDocumentFileException("Uploaded file is empty");
        }
        if (file.getSize() > maxFileSizeBytes) {
            throw new InvalidDocumentFileException(
                    "Uploaded file exceeds the maximum allowed size of " + (maxFileSizeBytes / (1024 * 1024)) + "MB");
        }

        String originalFilename = StringUtils.cleanPath(
                file.getOriginalFilename() == null ? "" : file.getOriginalFilename());
        String extension = extractExtension(originalFilename);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new InvalidDocumentFileException(
                    "Unsupported file extension '" + extension + "'. Allowed types: "
                            + String.join(", ", ALLOWED_EXTENSIONS).toUpperCase(Locale.ROOT));
        }

        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        Set<String> allowedContentTypes = ALLOWED_CONTENT_TYPES_BY_EXTENSION.get(extension);
        if (!allowedContentTypes.contains(contentType)) {
            throw new InvalidDocumentFileException(
                    "File content-type '" + contentType + "' does not match its extension ('" + extension
                            + "'). Allowed content-types: "
                            + allowedContentTypes.stream().collect(Collectors.joining(", ")));
        }

        String generatedFilename = UUID.randomUUID() + "." + extension;

        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read uploaded document file", e);
        }

        return new StoredDocument(content, generatedFilename, contentType, content.length);
    }

    private String extractExtension(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == filename.length() - 1) {
            return "";
        }
        return filename.substring(dotIndex + 1).toLowerCase(Locale.ROOT);
    }

    /**
     * Result of a successful {@link #store(MultipartFile)} call: the validated file's raw
     * bytes plus the metadata to persist alongside them.
     */
    public record StoredDocument(byte[] content, String fileName, String contentType, long sizeBytes) {
    }
}
