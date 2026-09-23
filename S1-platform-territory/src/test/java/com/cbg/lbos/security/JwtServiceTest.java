package com.cbg.lbos.security;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;

import org.junit.jupiter.api.Test;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.security.SignatureException;

class JwtServiceTest {

    private JwtProperties propertiesWith(long expirationMinutes) {
        JwtProperties properties = new JwtProperties();
        properties.setSecret("unit-test-shared-jwt-signing-secret-not-for-production-use-32b");
        properties.setExpirationMinutes(expirationMinutes);
        return properties;
    }

    @Test
    void generatedTokenCarriesSubjectEmailAndRole() {
        JwtService service = new JwtService(propertiesWith(60));
        UUID userAccountId = UUID.randomUUID();

        String token = service.generateToken(userAccountId, "manager@aroundu.local", "OPERATIONS_MANAGER");
        Claims claims = service.parseClaims(token);

        assertEquals(userAccountId.toString(), claims.getSubject());
        assertEquals("manager@aroundu.local", claims.get("email", String.class));
        assertEquals("OPERATIONS_MANAGER", claims.get("role", String.class));
        assertTrue(claims.getExpiration().after(claims.getIssuedAt()));
    }

    @Test
    void tokenSignedWithDifferentSecretFailsValidation() {
        JwtService issuer = new JwtService(propertiesWith(60));
        String token = issuer.generateToken(UUID.randomUUID(), "a@b.com", "CUSTOMER");

        JwtProperties otherSecret = new JwtProperties();
        otherSecret.setSecret("a-completely-different-shared-jwt-signing-secret-32-bytes-min");
        JwtService validator = new JwtService(otherSecret);

        assertThrows(SignatureException.class, () -> validator.parseClaims(token));
    }

    @Test
    void expirationSecondsReflectsConfiguredMinutes() {
        JwtService service = new JwtService(propertiesWith(15));
        assertEquals(900L, service.expirationSeconds());
    }
}
