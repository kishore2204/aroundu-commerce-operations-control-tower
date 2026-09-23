package com.cbg.lbos.security;

import java.security.Key;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Date;
import java.util.HexFormat;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/**
 * Issues and validates the platform-wide JWT. The signing key is shared with the API Gateway
 * (and any downstream service that chooses to validate tokens itself) via the same
 * {@code app.jwt.secret} property value.
 */
@Service
@EnableConfigurationProperties(JwtProperties.class)
public class JwtService {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);

    private final JwtProperties properties;
    private final Key signingKey;

    public JwtService(JwtProperties properties) {
        this.properties = properties;
        this.signingKey = Keys.hmacShaKeyFor(properties.getSecret().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        log.info("JWT signing key fingerprint: {} - every service AND the API Gateway must log "
                + "this exact fingerprint (same app.jwt.secret everywhere) or every authenticated "
                + "request will 401 immediately after login.", fingerprintOf(properties.getSecret()));
    }

    /** SHA-256 of the secret, first 8 hex chars only - identifies a mismatch without ever
     * logging the actual secret value. */
    private static String fingerprintOf(String secret) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 4);
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    public String generateToken(UUID userAccountId, String email, String role) {
        Instant now = Instant.now();
        Instant expiry = now.plusSeconds(properties.getExpirationMinutes() * 60);
        return Jwts.builder()
                .subject(userAccountId.toString())
                .claim("email", email)
                .claim("role", role)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(signingKey)
                .compact();
    }

    public long expirationSeconds() {
        return properties.getExpirationMinutes() * 60;
    }

    public Claims parseClaims(String token) throws JwtException {
        return Jwts.parser().verifyWith((javax.crypto.SecretKey) signingKey).build()
                .parseSignedClaims(token).getPayload();
    }
}
