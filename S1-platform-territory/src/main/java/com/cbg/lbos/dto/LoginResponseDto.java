package com.cbg.lbos.dto;

import java.util.UUID;

public class LoginResponseDto {
    private String accessToken;
    private String tokenType = "Bearer";
    private long expiresInSeconds;
    private UUID userAccountId;
    private String email;
    private String role;

    public LoginResponseDto(String accessToken, long expiresInSeconds, UUID userAccountId, String email, String role) {
        this.accessToken = accessToken;
        this.expiresInSeconds = expiresInSeconds;
        this.userAccountId = userAccountId;
        this.email = email;
        this.role = role;
    }

    public String getAccessToken() { return accessToken; }
    public String getTokenType() { return tokenType; }
    public long getExpiresInSeconds() { return expiresInSeconds; }
    public UUID getUserAccountId() { return userAccountId; }
    public String getEmail() { return email; }
    public String getRole() { return role; }
}
