package com.cbg.lbos.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.jwt")
public class JwtProperties {
    private String secret = "change-this-development-only-secret-key-please-32-bytes-min";

    public String getSecret() { return secret; }
    public void setSecret(String secret) { this.secret = secret; }
}
