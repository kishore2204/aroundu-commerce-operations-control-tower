package com.example.lbos.exception;

/** Thrown when an uploaded verification document file fails validation (type, size, or emptiness). */
public class InvalidDocumentFileException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public InvalidDocumentFileException(String message) {
        super(message);
    }
}
