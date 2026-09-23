package com.cbg.lbos.controller;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import jakarta.validation.Valid;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.cbg.lbos.dto.UserAccountRequestDto;
import com.cbg.lbos.dto.UserAccountResponseDto;
import com.cbg.lbos.dto.UserAccountStatusRequestDto;
import com.cbg.lbos.service.LocationManagerService;
import com.cbg.lbos.service.UserAccountService;

@RestController
@RequestMapping("/api/user-accounts")
public class UserAccountController {

    private final UserAccountService userAccountService;
    private final LocationManagerService locationManagerService;

    public UserAccountController(
            UserAccountService userAccountService, LocationManagerService locationManagerService) {

        this.userAccountService = userAccountService;
        this.locationManagerService = locationManagerService;
    }

    @PostMapping
    public ResponseEntity<UserAccountResponseDto>
            createUserAccount(
                    @Valid @RequestBody UserAccountRequestDto requestDto) {

        UserAccountResponseDto createdUserAccount =
                userAccountService.createUserAccount(requestDto);

        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(createdUserAccount.getId())
                .toUri();

        return ResponseEntity
                .created(location)
                .body(createdUserAccount);
    }

    @GetMapping
    public ResponseEntity<List<UserAccountResponseDto>>
            getAllUserAccounts() {

        return ResponseEntity.ok(
                userAccountService.getAllUserAccounts());
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserAccountResponseDto>
            getUserAccountById(@PathVariable UUID id) {

        return ResponseEntity.ok(
                userAccountService.getUserAccountById(id));
    }

    @GetMapping("/search-by-email")
    public ResponseEntity<UserAccountResponseDto>
            getUserAccountByEmail(
                    @RequestParam String email) {

        return ResponseEntity.ok(
                userAccountService
                        .getUserAccountByEmail(email));
    }

    @GetMapping("/role/{role}")
    public ResponseEntity<List<UserAccountResponseDto>>
            getUserAccountsByRole(
                    @PathVariable String role) {

        return ResponseEntity.ok(
                userAccountService
                        .getUserAccountsByRole(role));
    }

    @GetMapping("/status/{accountStatus}")
    public ResponseEntity<List<UserAccountResponseDto>>
            getUserAccountsByStatus(
                    @PathVariable String accountStatus) {

        return ResponseEntity.ok(
                userAccountService
                        .getUserAccountsByStatus(accountStatus));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserAccountResponseDto>
            updateUserAccount(
                    @PathVariable UUID id,
                    @Valid @RequestBody UserAccountRequestDto requestDto) {

        return ResponseEntity.ok(
                userAccountService
                        .updateUserAccount(id, requestDto));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<UserAccountResponseDto>
            updateUserAccountStatus(
                    @PathVariable UUID id,
                    @Valid @RequestBody UserAccountStatusRequestDto statusRequest) {

        locationManagerService.assertAccountStatusChangeAllowed(id, statusRequest.accountStatus());
        return ResponseEntity.ok(
                userAccountService
                        .updateAccountStatus(id, statusRequest.accountStatus()));
    }

    @PatchMapping("/{id}/last-login")
    public ResponseEntity<UserAccountResponseDto>
            updateLastLogin(@PathVariable UUID id) {

        return ResponseEntity.ok(
                userAccountService.updateLastLogin(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUserAccount(
            @PathVariable UUID id) {

        userAccountService.deleteUserAccount(id);

        return ResponseEntity.noContent().build();
    }
}