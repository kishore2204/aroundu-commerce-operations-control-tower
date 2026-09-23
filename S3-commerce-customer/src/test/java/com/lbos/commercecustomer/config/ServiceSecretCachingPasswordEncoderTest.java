package com.lbos.commercecustomer.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;

/** The shared service secret is BCrypt-verified once and then answered from memory; nothing else is shortcut. */
class ServiceSecretCachingPasswordEncoderTest {

    @Test
    void theCorrectServiceSecretIsVerifiedByTheDelegateOnlyOnce() {
        PasswordEncoder delegate = mock(PasswordEncoder.class);
        when(delegate.encode("s3cret")).thenReturn("{bcrypt}hash");
        when(delegate.matches("s3cret", "{bcrypt}hash")).thenReturn(true);
        ServiceSecretCachingPasswordEncoder encoder = new ServiceSecretCachingPasswordEncoder(delegate);
        String stored = encoder.encodeServiceSecret("s3cret");

        for (int i = 0; i < 5; i++) {
            assertTrue(encoder.matches("s3cret", stored));
        }

        verify(delegate, times(1)).matches(any(), any());
    }

    @Test
    void aWrongSecretIsAlwaysCheckedByTheDelegateAndNeverAccepted() {
        PasswordEncoder delegate = mock(PasswordEncoder.class);
        when(delegate.encode("s3cret")).thenReturn("{bcrypt}hash");
        when(delegate.matches("s3cret", "{bcrypt}hash")).thenReturn(true);
        when(delegate.matches("wrong", "{bcrypt}hash")).thenReturn(false);
        ServiceSecretCachingPasswordEncoder encoder = new ServiceSecretCachingPasswordEncoder(delegate);
        String stored = encoder.encodeServiceSecret("s3cret");
        assertTrue(encoder.matches("s3cret", stored)); // the correct one is now remembered

        assertFalse(encoder.matches("wrong", stored));
        assertFalse(encoder.matches("wrong", stored));

        verify(delegate, times(2)).matches("wrong", "{bcrypt}hash");
    }

    @Test
    void userPasswordsAreNeverRemembered() {
        PasswordEncoder real = PasswordEncoderFactories.createDelegatingPasswordEncoder();
        ServiceSecretCachingPasswordEncoder encoder = new ServiceSecretCachingPasswordEncoder(real);
        encoder.encodeServiceSecret("s3cret");
        String userHash = encoder.encode("Lbos@2026!");

        assertTrue(encoder.matches("Lbos@2026!", userHash));
        assertFalse(encoder.matches("Lbos@2026?", userHash));
        assertTrue(encoder.matches("Lbos@2026!", userHash));
    }

    @Test
    void theRealEncoderStillRejectsAWrongServiceSecretAfterTheRightOneWasSeen() {
        ServiceSecretCachingPasswordEncoder encoder = new ServiceSecretCachingPasswordEncoder(PasswordEncoderFactories.createDelegatingPasswordEncoder());
        String stored = encoder.encodeServiceSecret("service123");

        assertTrue(encoder.matches("service123", stored));
        assertTrue(encoder.matches("service123", stored));
        assertFalse(encoder.matches("service124", stored));
        assertFalse(encoder.matches("", stored));
    }
}
