package com.lbos.finance.controller;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import com.lbos.finance.dto.TaxConfigurationCategoryRequest; import com.lbos.finance.dto.TaxConfigurationSaveResponse; import com.lbos.finance.service.TaxConfigurationByCategoryNameService;
import com.lbos.finance.dto.TaxConfigurationRequest; import com.lbos.finance.entity.TaxConfiguration; import com.lbos.finance.service.TaxConfigurationService;
@RestController @RequestMapping("/api/tax-configurations")
public class TaxConfigurationController {
    private final TaxConfigurationService taxConfigurationService;
    private final TaxConfigurationByCategoryNameService byCategoryNameService;
    public TaxConfigurationController(TaxConfigurationService taxConfigurationService, TaxConfigurationByCategoryNameService byCategoryNameService) { this.taxConfigurationService = taxConfigurationService; this.byCategoryNameService = byCategoryNameService; }
    /** New tax rule with a TYPED category: reuses / creates the S3 category, then creates or updates the rule. Only a Super Admin may add a category. */
    @PostMapping("/by-category-name") public TaxConfigurationSaveResponse saveByCategoryName(@RequestBody TaxConfigurationCategoryRequest request, Authentication authentication) {
        boolean superAdmin = authentication != null && authentication.getAuthorities().stream().anyMatch(a -> "ROLE_SUPER_ADMIN".equals(a.getAuthority()));
        return byCategoryNameService.save(request, superAdmin);
    }
    @PostMapping public TaxConfiguration createTaxConfiguration(@Valid @RequestBody TaxConfigurationRequest request) { return taxConfigurationService.createTaxConfiguration(request); }
    @GetMapping public List<TaxConfiguration> getAllTaxConfigurations() { return taxConfigurationService.getAllTaxConfigurations(); }
    @GetMapping("/{id}") public TaxConfiguration getTaxConfigurationById(@PathVariable UUID id) { return taxConfigurationService.getTaxConfigurationById(id); }
    @PutMapping("/{id}") public TaxConfiguration updateTaxConfiguration(@PathVariable UUID id, @Valid @RequestBody TaxConfigurationRequest request) { return taxConfigurationService.updateTaxConfiguration(id, request); }
    @DeleteMapping("/{id}") public void deleteTaxConfiguration(@PathVariable UUID id) { taxConfigurationService.deleteTaxConfiguration(id); }
}
