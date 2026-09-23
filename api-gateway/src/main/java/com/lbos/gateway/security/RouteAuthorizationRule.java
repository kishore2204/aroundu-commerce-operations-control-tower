package com.lbos.gateway.security;

import java.util.Set;

/**
 * One route-group authorization rule: requests whose path matches {@code pathPattern}
 * (Ant-style, e.g. {@code /api/v1/products/**}) are only allowed through to the downstream
 * service if the authenticated caller's role is in {@code allowedRoles}.
 */
public record RouteAuthorizationRule(String pathPattern, Set<String> allowedRoles) {
}
