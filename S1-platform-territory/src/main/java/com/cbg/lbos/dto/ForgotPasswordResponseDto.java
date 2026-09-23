package com.cbg.lbos.dto;

/**
 * resetToken/resetLink are only populated when the email matches a real account, and only
 * because no email provider exists anywhere in this codebase - a real deployment would email
 * the link and leave both fields null here. message is always a generic
 * "if this email exists..." line so the response never reveals whether an account exists.
 */
public class ForgotPasswordResponseDto {
    private final String message;
    private final String resetToken;
    private final String resetLink;

    public ForgotPasswordResponseDto(String message, String resetToken, String resetLink) {
        this.message = message;
        this.resetToken = resetToken;
        this.resetLink = resetLink;
    }

    public String getMessage() { return message; }
    public String getResetToken() { return resetToken; }
    public String getResetLink() { return resetLink; }
}
