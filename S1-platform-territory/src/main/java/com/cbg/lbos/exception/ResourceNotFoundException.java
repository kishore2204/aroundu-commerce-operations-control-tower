package com.cbg.lbos.exception;
/** Raised when a requested record cannot be found. */
public class ResourceNotFoundException extends RuntimeException { private static final long serialVersionUID=1L; public ResourceNotFoundException(String message){super(message);} }
