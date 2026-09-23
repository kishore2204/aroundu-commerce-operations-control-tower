package com.lbos.commercecustomer.dto.response;

/** Filesystem-backed product image metadata. Images intentionally live outside the database. */
public record ProductImageResponse(String fileName, String url, boolean primary) {}
