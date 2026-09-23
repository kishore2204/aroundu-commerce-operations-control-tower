package com.cbg.lbos.config;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * The platform's password encoder with ONE addition: the shared service-to-service secret is verified with BCrypt the
 * first time and remembered afterwards.
 *
 * Why: every internal call (Feign, HTTP Basic user {@code lbos-service}) was re-verified with BCrypt on the receiving
 * side - measured about 90 ms per call against about 4 ms for a request without credentials - so a list that enriches
 * each row with an internal call paid that 90 ms per row.
 *
 * What is NOT changed: user passwords, wrong secrets and unknown accounts always take the normal BCrypt path, so guessing
 * is exactly as slow as before. Only a request that presents the correct service secret is answered from memory, and it is
 * compared as a SHA-256 digest in constant time. The digest is never stored anywhere but this object's memory.
 */
public final class ServiceSecretCachingPasswordEncoder implements PasswordEncoder {

    private final PasswordEncoder delegate;
    /** The encoded (BCrypt) form of the service secret - the only stored value this encoder shortcuts. */
    private volatile String serviceSecretEncoded;
    /** SHA-256 of the service secret, set once the delegate has confirmed it. */
    private volatile byte[] verifiedDigest;

    public ServiceSecretCachingPasswordEncoder(PasswordEncoder delegate) {
        this.delegate = delegate;
    }

    /** Encodes the shared service secret and remembers which stored value it is. */
    public String encodeServiceSecret(String secret) {
        String encoded = delegate.encode(secret);
        this.serviceSecretEncoded = encoded;
        this.verifiedDigest = null;
        return encoded;
    }

    @Override
    public String encode(CharSequence rawPassword) {
        return delegate.encode(rawPassword);
    }

    @Override
    public boolean matches(CharSequence rawPassword, String encodedPassword) {
        if (rawPassword != null && encodedPassword != null && encodedPassword.equals(serviceSecretEncoded)) {
            byte[] digest = sha256(rawPassword);
            byte[] known = verifiedDigest;
            if (known != null && MessageDigest.isEqual(known, digest)) {
                return true;
            }
            boolean matches = delegate.matches(rawPassword, encodedPassword);
            if (matches) {
                verifiedDigest = digest;
            }
            return matches;
        }
        return delegate.matches(rawPassword, encodedPassword);
    }

    @Override
    public boolean upgradeEncoding(String encodedPassword) {
        return delegate.upgradeEncoding(encodedPassword);
    }

    private static byte[] sha256(CharSequence value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.toString().getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
