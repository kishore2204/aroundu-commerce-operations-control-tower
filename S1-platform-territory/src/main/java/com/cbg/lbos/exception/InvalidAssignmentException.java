package com.cbg.lbos.exception;
/** Raised when an assignment violates a business rule. */
public class InvalidAssignmentException extends RuntimeException { private static final long serialVersionUID=1L; public InvalidAssignmentException(String message){super(message);} }
