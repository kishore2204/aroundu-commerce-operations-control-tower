package com.example.lbos.exception;

public class VerificationDocumentNotFoundException extends RuntimeException {
    private static final long serialVersionUID = 1L;
    
    public VerificationDocumentNotFoundException(String message) {
        super(message);
    }
}
