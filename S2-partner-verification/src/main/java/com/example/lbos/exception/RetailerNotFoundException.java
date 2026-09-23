package com.example.lbos.exception;

public class RetailerNotFoundException extends RuntimeException {
    private static final long serialVersionUID = 1L;
    
    public RetailerNotFoundException(String message) {
        super(message);
    }
}
