package com.cbg.lbos.exception;
/** Raised when a business record would be duplicated. */
public class DuplicateResourceException extends RuntimeException { private static final long serialVersionUID=1L; public DuplicateResourceException(String message){super(message);} }
