package com.lbos.finance.service;
import java.util.List;
import java.util.UUID;
import com.lbos.finance.dto.TaxConfigurationRequest;
import com.lbos.finance.entity.TaxConfiguration;
public interface TaxConfigurationService {
    TaxConfiguration createTaxConfiguration(TaxConfigurationRequest request);
    List<TaxConfiguration> getAllTaxConfigurations();
    TaxConfiguration getTaxConfigurationById(UUID id);
    TaxConfiguration updateTaxConfiguration(UUID id, TaxConfigurationRequest request);
    void deleteTaxConfiguration(UUID id);
}
