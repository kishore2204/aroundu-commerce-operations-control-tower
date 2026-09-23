package com.cbg.lbos.controller;

import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.cbg.lbos.dto.StateDto;
import com.cbg.lbos.service.StateService;

/**
 * Service-to-service lookup of state data (e.g. S6 validating a tax-configuration's
 * stateId). Gated by hasRole("SERVICE") like the other /internal/** endpoints - not for
 * browser/end-user use. /api/states/** is JWT+SUPER_ADMIN-gated and unreachable for a
 * plain service call.
 */
@RestController
@RequestMapping("/internal/v1/states")
public class InternalStateController {

    public record InternalStateResponse(UUID stateId, String stateName, String countryCode, Boolean active) {
    }

    private final StateService stateService;

    public InternalStateController(StateService stateService) {
        this.stateService = stateService;
    }

    @GetMapping("/{id}")
    public InternalStateResponse get(@PathVariable UUID id) {
        StateDto state = stateService.getStateById(id);
        return new InternalStateResponse(state.getId(), state.getStateName(), state.getCountryCode(), state.getIsActive());
    }
}
