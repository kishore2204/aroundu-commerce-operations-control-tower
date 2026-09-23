package com.lbos.finance.service;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.lbos.finance.entity.TaxConfiguration;
import com.lbos.finance.integration.client.CatalogServiceClient;
import com.lbos.finance.integration.dto.ProductCategoryResponse;
import com.lbos.finance.repository.TaxConfigurationRepository;

/**
 * Migrates legacy tax configurations (created when the category was only a typed name) onto the product-category
 * link. A configuration without a productCategoryId whose old taxCategoryName matches the name of an ACTIVE S3
 * category (case-insensitive) is linked to that category's id; nothing is deleted and the old name is kept as the
 * display name. Rows that match nothing stay as they are (they simply never apply until an admin picks a category
 * for them). The S3 category list is read through the existing catalog client, once per attempt; attempts are
 * throttled and best effort, so an unreachable S3 never blocks S6.
 */
@Component
public class TaxConfigurationCategoryLinker {

    private static final Logger log = LoggerFactory.getLogger(TaxConfigurationCategoryLinker.class);
    private static final Duration MIN_ATTEMPT_INTERVAL = Duration.ofSeconds(30);

    private final TaxConfigurationRepository taxConfigurationRepository;
    private final CatalogServiceClient catalogServiceClient;
    private volatile Instant lastAttempt = Instant.MIN;

    public TaxConfigurationCategoryLinker(TaxConfigurationRepository taxConfigurationRepository, CatalogServiceClient catalogServiceClient) {
        this.taxConfigurationRepository = taxConfigurationRepository;
        this.catalogServiceClient = catalogServiceClient;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void linkAtStartup() {
        try {
            linkLegacyConfigurations();
        } catch (RuntimeException failure) {
            log.info("Tax configurations were not linked to product categories at startup (catalog not reachable yet): {}", failure.getMessage());
        }
    }

    /** @return true when at least one configuration was linked. */
    @Transactional
    public boolean linkLegacyConfigurations() {
        List<TaxConfiguration> unlinked = taxConfigurationRepository.findByProductCategoryIdIsNull();
        if (unlinked.isEmpty()) return false;
        Instant now = Instant.now();
        if (lastAttempt.plus(MIN_ATTEMPT_INTERVAL).isAfter(now)) return false;
        lastAttempt = now;

        Map<String, Long> categoryIdByName = new HashMap<>();
        for (ProductCategoryResponse category : catalogServiceClient.getActiveProductCategories()) {
            if (category.id() != null && category.name() != null) categoryIdByName.putIfAbsent(normalize(category.name()), category.id());
        }
        boolean linkedAny = false;
        for (TaxConfiguration configuration : unlinked) {
            Long categoryId = configuration.getTaxCategoryName() == null ? null : categoryIdByName.get(normalize(configuration.getTaxCategoryName()));
            if (categoryId != null) {
                configuration.setProductCategoryId(categoryId);
                taxConfigurationRepository.save(configuration);
                linkedAny = true;
            }
        }
        return linkedAny;
    }

    private static String normalize(String name) {
        return name.trim().toLowerCase(Locale.ROOT);
    }
}
