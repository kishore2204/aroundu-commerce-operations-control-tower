package com.cbg.lbos.controller;

import java.util.UUID;
import org.springframework.web.bind.annotation.*;
import com.cbg.lbos.dto.UserAccountResponseDto;
import com.cbg.lbos.service.LoginEligibilityService;
import com.cbg.lbos.service.UserAccountService;

/**
 * Service-to-service lookup of user accounts (e.g. S4 validating a Trip's
 * createdByAccountId/assignedByAccountId). Gated by hasRole("SERVICE") like the other
 * /internal/** endpoints - not for browser/end-user use.
 */
@RestController
@RequestMapping("/internal/v1/user-accounts")
public class InternalUserAccountController {
    private final UserAccountService userAccountService;
    private final LoginEligibilityService loginEligibilityService;

    public InternalUserAccountController(UserAccountService userAccountService,
            LoginEligibilityService loginEligibilityService) {
        this.userAccountService = userAccountService;
        this.loginEligibilityService = loginEligibilityService;
    }

    /**
     * Whether an already-authenticated account may keep using the portal - i.e. it and every
     * parent in its role hierarchy is still active. The API Gateway calls this (briefly cached)
     * for each bearer token so an account made inactive after login stops working before its JWT
     * expires. See {@link LoginEligibilityService}.
     */
    @GetMapping("/{id}/login-eligibility")
    public LoginEligibilityService.Eligibility loginEligibility(@PathVariable UUID id) {
        return loginEligibilityService.evaluate(id);
    }

    @GetMapping("/{id}")
    public UserAccountResponseDto get(@PathVariable UUID id) {
        return userAccountService.getUserAccountById(id);
    }

    /** Batch lookup (name/email/phone) so a list of partners costs one call, not one per row. */
    @PostMapping("/batch")
    public java.util.List<UserAccountResponseDto> batch(@RequestBody java.util.List<UUID> ids) {
        return userAccountService.getUserAccountsByIds(ids);
    }

    /** Ids of accounts of the given roles matching a name/email/phone fragment. */
    @GetMapping("/search-ids")
    public java.util.List<UUID> searchIds(@RequestParam("term") String term, @RequestParam("roles") java.util.List<String> roles) {
        return userAccountService.searchAccountIds(term, roles);
    }

    @PostMapping
    public UserAccountResponseDto create(@RequestBody com.cbg.lbos.dto.UserAccountRequestDto request) {
        return userAccountService.createUserAccount(request);
    }
    /**
     * Also reachable as POST: the services call this over Feign, whose default HTTP client cannot send PATCH at all ("Invalid
     * HTTP method: PATCH"), so a PATCH-based call from S2/S5 failed before it ever reached this method and the account status
     * silently stayed as it was. PATCH is kept for any caller that can use it.
     */
    @RequestMapping(value = "/{id}/status", method = {RequestMethod.PATCH, RequestMethod.POST})
    public UserAccountResponseDto updateStatus(@PathVariable UUID id, @RequestBody java.util.Map<String, String> request) {
        String status = request.get("accountStatus");
        return userAccountService.updateAccountStatus(id, status);
    }
}


