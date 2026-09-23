package com.lbos.commercecustomer.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.domain.Specification;

import com.lbos.commercecustomer.client.PartnerVerificationClient;
import com.lbos.commercecustomer.entity.Product;
import com.lbos.commercecustomer.entity.ProductCategory;
import com.lbos.commercecustomer.enums.ProductStatus;
import com.lbos.commercecustomer.mapper.CommerceMapper;
import com.lbos.commercecustomer.repository.ProductRepository;
import com.lbos.commercecustomer.service.impl.FeignCallSupport;
import com.lbos.commercecustomer.service.impl.ProductDiscoveryServiceImpl;
import com.lbos.commercecustomer.service.impl.RetailerEnrichmentSupport;

/**
 * getByIds() replaces the one-GET-per-product loop of S4's checkout serviceability check: the same "active product of a shop that
 * is open" rule as get(id), applied to a whole list of ids in ONE query and ONE open-shops lookup.
 */
class ProductDiscoveryServiceBatchTest {

    private final UUID openShop = UUID.randomUUID();
    private final UUID closedShop = UUID.randomUUID();

    private Product product(long id, UUID shop) {
        Product product = new Product();
        product.setId(id);
        product.setStatus(ProductStatus.ACTIVE);
        product.setRetailerId(shop);
        ProductCategory category = new ProductCategory();
        category.setId(1L);
        product.setCategory(category);
        return product;
    }

    @SuppressWarnings("unchecked")
    @Test
    void onlyProductsOfOpenShopsAreReturnedAndTheOpenShopListIsReadOnce() {
        ProductRepository repository = mock(ProductRepository.class);
        when(repository.findAll(any(Specification.class))).thenReturn(List.of(product(1, openShop), product(2, closedShop), product(3, openShop)));
        PartnerVerificationClient partner = mock(PartnerVerificationClient.class);
        when(partner.openRetailerIds()).thenReturn(List.of(openShop));
        var service = new ProductDiscoveryServiceImpl(repository, new CommerceMapper(),
                new RetailerEnrichmentSupport(partner, new FeignCallSupport()));

        var result = service.getByIds(List.of(1L, 2L, 3L));

        assertEquals(List.of(1L, 3L), result.stream().map(r -> r.id()).toList());
        verify(partner, times(1)).openRetailerIds();
    }

    @Test
    void anEmptyIdListReadsNothing() {
        ProductRepository repository = mock(ProductRepository.class);
        var service = new ProductDiscoveryServiceImpl(repository, new CommerceMapper(),
                new RetailerEnrichmentSupport(mock(PartnerVerificationClient.class), new FeignCallSupport()));

        assertTrue(service.getByIds(List.of()).isEmpty());
        verify(repository, times(0)).findAll(any(Specification.class));
    }
}
