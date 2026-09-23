package com.example.lbos.exception;

public class VerificationQueueNotFoundException extends RuntimeException {
    private static final long serialVersionUID = 1L;
    
    public VerificationQueueNotFoundException(String message) {
        super(message);
    }
}
