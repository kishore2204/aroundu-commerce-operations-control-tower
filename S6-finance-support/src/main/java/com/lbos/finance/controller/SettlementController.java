package com.lbos.finance.controller;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import com.lbos.finance.dto.SettlementRequest; import com.lbos.finance.dto.SettlementUpdateRequest; import com.lbos.finance.entity.Settlement; import com.lbos.finance.service.SettlementService;
@RestController @RequestMapping("/api/settlements")
public class SettlementController {
    private final SettlementService settlementService;
    public SettlementController(SettlementService settlementService) { this.settlementService = settlementService; }
    @PostMapping public Settlement createSettlement(@Valid @RequestBody SettlementRequest request) { return settlementService.createSettlement(request); }

    /**
     * Staff (SUPER_ADMIN / OPERATIONS_MANAGER) see every settlement; a RETAILER or FLEET_MANAGER sees only their OWN, with
     * the payee resolved server-side from the JWT subject (SecurityConfig lets no other role reach this route). Before this,
     * any signed-in user received every business's payout data on the platform.
     */
    @GetMapping public List<Settlement> getAllSettlements(Authentication authentication) {
        String partnerType = partnerPayeeType(authentication);
        return partnerType == null
                ? settlementService.getAllSettlements()
                : settlementService.getSettlementsForPartner(partnerType, UUID.fromString(authentication.getName()));
    }

    @GetMapping("/{id}") public Settlement getSettlementById(@PathVariable UUID id, Authentication authentication) {
        String partnerType = partnerPayeeType(authentication);
        return partnerType == null
                ? settlementService.getSettlementById(id)
                : settlementService.getSettlementByIdForPartner(id, partnerType, UUID.fromString(authentication.getName()));
    }

    /** "RETAILER" / "FLEET_OWNER" for a partner caller who must only see their own rows; null for staff. */
    private static String partnerPayeeType(Authentication authentication) {
        boolean staff = has(authentication, "ROLE_SUPER_ADMIN") || has(authentication, "ROLE_OPERATIONS_MANAGER");
        if (staff) return null;
        if (has(authentication, "ROLE_RETAILER")) return "RETAILER";
        if (has(authentication, "ROLE_FLEET_MANAGER")) return "FLEET_OWNER";
        // Not reachable through SecurityConfig; fail closed rather than fall back to "everything".
        throw new org.springframework.security.access.AccessDeniedException("Settlements are not available to this role");
    }

    private static boolean has(Authentication authentication, String role) {
        return authentication.getAuthorities().stream().anyMatch(authority -> role.equals(authority.getAuthority()));
    }

    @PutMapping("/{id}") public Settlement updateSettlement(@PathVariable UUID id, @RequestBody SettlementUpdateRequest request) { return settlementService.updateSettlement(id, request); }
    @PostMapping("/{id}/complete") public Settlement complete(@PathVariable UUID id) { return settlementService.completeSettlement(id); }
    @DeleteMapping("/{id}") public void deleteSettlement(@PathVariable UUID id) { settlementService.deleteSettlement(id); }
}
