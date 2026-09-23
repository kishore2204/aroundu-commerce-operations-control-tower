package com.lbos.finance.controller;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import com.lbos.finance.dto.SettlementRequest; import com.lbos.finance.dto.SettlementUpdateRequest; import com.lbos.finance.entity.Settlement; import com.lbos.finance.service.SettlementService;
@RestController @RequestMapping("/api/settlements")
public class SettlementController {
    private final SettlementService settlementService;
    public SettlementController(SettlementService settlementService) { this.settlementService = settlementService; }
    @PostMapping public Settlement createSettlement(@Valid @RequestBody SettlementRequest request) { return settlementService.createSettlement(request); }
    @GetMapping public List<Settlement> getAllSettlements() { return settlementService.getAllSettlements(); }
    @GetMapping("/{id}") public Settlement getSettlementById(@PathVariable UUID id) { return settlementService.getSettlementById(id); }
    @PutMapping("/{id}") public Settlement updateSettlement(@PathVariable UUID id, @RequestBody SettlementUpdateRequest request) { return settlementService.updateSettlement(id, request); }
    @PostMapping("/{id}/complete") public Settlement complete(@PathVariable UUID id) { return settlementService.completeSettlement(id); }
    @DeleteMapping("/{id}") public void deleteSettlement(@PathVariable UUID id) { settlementService.deleteSettlement(id); }
}
