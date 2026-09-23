package com.example.lbos.exception;

public class FleetOwnerNotFoundException extends RuntimeException {
    private static final long serialVersionUID = 1L;
    
    public FleetOwnerNotFoundException(String message) {
        super(message);
    }
}
