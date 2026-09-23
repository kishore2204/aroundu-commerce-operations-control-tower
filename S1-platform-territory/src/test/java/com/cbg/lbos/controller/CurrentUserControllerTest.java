package com.cbg.lbos.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;

import com.cbg.lbos.dto.UserAccountResponseDto;
import com.cbg.lbos.exception.MissingAuthenticatedUserException;
import com.cbg.lbos.service.UserAccountService;

@ExtendWith(MockitoExtension.class)
class CurrentUserControllerTest {

    @Mock
    private UserAccountService userAccountService;
    @Mock
    private Authentication authentication;

    private CurrentUserController currentUserController;

    @Test
    void returnsProfileForAuthenticatedSubject() {
        currentUserController = new CurrentUserController(userAccountService);
        UUID authenticatedUserAccountId = UUID.randomUUID();
        when(authentication.getName()).thenReturn(authenticatedUserAccountId.toString());
        UserAccountResponseDto expectedProfile = new UserAccountResponseDto();
        when(userAccountService.getUserAccountById(authenticatedUserAccountId)).thenReturn(expectedProfile);

        var response = currentUserController.getCurrentUser(authentication);

        assertEquals(200, response.getStatusCode().value());
        assertSame(expectedProfile, response.getBody());
    }

    @Test
    void rejectsMissingAuthentication() {
        currentUserController = new CurrentUserController(userAccountService);
        assertThrows(MissingAuthenticatedUserException.class, () -> currentUserController.getCurrentUser(null));
    }

    @Test
    void rejectsNonUuidSubject() {
        currentUserController = new CurrentUserController(userAccountService);
        when(authentication.getName()).thenReturn("not-a-uuid");
        assertThrows(MissingAuthenticatedUserException.class, () -> currentUserController.getCurrentUser(authentication));
    }
}
