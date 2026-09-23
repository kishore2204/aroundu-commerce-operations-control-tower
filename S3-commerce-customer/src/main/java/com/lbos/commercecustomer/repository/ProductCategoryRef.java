package com.lbos.commercecustomer.repository;

/** A product id with the id of its category - read straight from the products table (no category join or lazy load). */
public record ProductCategoryRef(Long productId, Long categoryId) {
}
