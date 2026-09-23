package com.cbg.lbos.controller;

import java.net.URI;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import com.cbg.lbos.dto.OperationsManagerDtos.*;
import com.cbg.lbos.entity.AssignmentStatus;
import com.cbg.lbos.service.OperationsManagerService;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/operations-managers")
public class OperationsManagerController {
    private final OperationsManagerService operationsManagerService;
    public OperationsManagerController(OperationsManagerService operationsManagerService) { this.operationsManagerService = operationsManagerService; }
    @PostMapping
    public ResponseEntity<Response> create(@Valid @RequestBody CreateRequest request) {
        Response response = operationsManagerService.create(request);
        return ResponseEntity.created(URI.create("/api/v1/operations-managers/" + response.id())).body(response);
    }
    @GetMapping("/{id}") public Response get(@PathVariable UUID id) { return operationsManagerService.get(id); }
    @GetMapping("/by-user/{id}") public Response user(@PathVariable UUID id) { return operationsManagerService.byUser(id); }
    @GetMapping
    public Page<Response> list(@RequestParam(required = false) UUID cityId,
                               @RequestParam(required = false) AssignmentStatus status,
                               @RequestParam(required = false) String q,
                               @PageableDefault(size = 20) Pageable pageable) {
        return operationsManagerService.list(cityId, status, q, pageable);
    }
    @PutMapping("/{id}") public Response update(@PathVariable UUID id, @Valid @RequestBody UpdateRequest request) { return operationsManagerService.update(id, request); }
    @PatchMapping("/{id}/city") public Response city(@PathVariable UUID id, @Valid @RequestBody ReassignCityRequest request) { return operationsManagerService.reassign(id, request); }
    @PatchMapping("/{id}/status") public Response status(@PathVariable UUID id, @Valid @RequestBody StatusRequest request) { return operationsManagerService.status(id, request); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@PathVariable UUID id) { operationsManagerService.delete(id); }
    @GetMapping("/summary") public Summary summary() { return operationsManagerService.summary(); }
}
