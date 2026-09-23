package com.lbos.finance.integration.dto;

/** The part of S3's ApiResponse envelope S6 needs: the payload under "data". Other envelope fields are ignored. */
public record CatalogEnvelope<T>(String message, T data) { }
