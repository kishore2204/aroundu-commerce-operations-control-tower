package com.cbg.lbos.controller;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import jakarta.validation.Valid;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.cbg.lbos.dto.StateDto;
import com.cbg.lbos.service.StateService;

@RestController
@RequestMapping("/api/states")
public class StateController {

    private final StateService stateService;

    public StateController(StateService stateService) {
        this.stateService = stateService;
    }

    @PostMapping
    public ResponseEntity<StateDto> createState(
            @Valid @RequestBody StateDto stateDto) {

        StateDto createdState =
                stateService.createState(stateDto);

        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(createdState.getId())
                .toUri();

        return ResponseEntity
                .created(location)
                .body(createdState);
    }

    @GetMapping
    public ResponseEntity<List<StateDto>> getAllStates() {
        return ResponseEntity.ok(
                stateService.getAllStates());
    }

    @GetMapping("/{id}")
    public ResponseEntity<StateDto> getStateById(
            @PathVariable UUID id) {

        return ResponseEntity.ok(
                stateService.getStateById(id));
    }

    @GetMapping("/country/{countryCode}")
    public ResponseEntity<List<StateDto>>
            getStatesByCountryCode(
                    @PathVariable String countryCode) {

        return ResponseEntity.ok(
                stateService
                        .getStatesByCountryCode(countryCode));
    }

    @GetMapping("/active")
    public ResponseEntity<List<StateDto>>
            getStatesByActiveStatus(
                    @RequestParam Boolean isActive) {

        return ResponseEntity.ok(
                stateService
                        .getStatesByActiveStatus(isActive));
    }

    @PutMapping("/{id}")
    public ResponseEntity<StateDto> updateState(
            @PathVariable UUID id,
            @Valid @RequestBody StateDto stateDto) {

        return ResponseEntity.ok(
                stateService.updateState(id, stateDto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteState(
            @PathVariable UUID id) {

        stateService.deleteState(id);

        return ResponseEntity.noContent().build();
    }
}