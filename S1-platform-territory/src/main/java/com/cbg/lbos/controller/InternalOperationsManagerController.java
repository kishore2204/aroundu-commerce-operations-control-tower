package com.cbg.lbos.controller;

import java.util.UUID;
import org.springframework.web.bind.annotation.*;
import com.cbg.lbos.dto.OperationsManagerDtos.*;
import com.cbg.lbos.service.OperationsManagerService;

@RestController
@RequestMapping("/internal/v1/operations-managers")
public class InternalOperationsManagerController {
    private final OperationsManagerService operationsManagerService;
    public InternalOperationsManagerController(OperationsManagerService operationsManagerService) { this.operationsManagerService = operationsManagerService; }
    @GetMapping("/{id}") public InternalAssignment get(@PathVariable UUID id) { return operationsManagerService.getInternalAssignment(id); }
    @GetMapping("/resolve") public InternalAssignment resolve(@RequestParam UUID userAccountId) { return operationsManagerService.resolve(userAccountId); }
    @GetMapping("/city/{id}/active") public InternalAssignment city(@PathVariable UUID id) { return operationsManagerService.activeCity(id); }
    @GetMapping("/{id}/validate-city/{cityId}") public ValidationResponse validate(@PathVariable UUID id, @PathVariable UUID cityId) { return operationsManagerService.validate(id, cityId); }
}
