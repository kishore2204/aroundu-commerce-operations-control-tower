package com.example.lbos.exception;

public class MissingAuthenticatedUserException extends RuntimeException {
    public MissingAuthenticatedUserException(String message) {
        super(message);
    }
}
