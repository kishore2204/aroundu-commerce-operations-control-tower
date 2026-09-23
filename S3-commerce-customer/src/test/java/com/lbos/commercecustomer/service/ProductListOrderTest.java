package com.lbos.commercecustomer.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import com.lbos.commercecustomer.client.PartnerVerificationClient;
import com.lbos.commercecustomer.dto.client.partner.RetailerContextResponse;
import com.lbos.commercecustomer.entity.Product;
import com.lbos.commercecustomer.mapper.CommerceMapper;
import com.lbos.commercecustomer.repository.CustomerCartRepository;
import com.lbos.commercecustomer.repository.CustomerReviewRepository;
import com.lbos.commercecustomer.repository.CustomerWishlistItemRepository;
import com.lbos.commercecustomer.repository.ProductCategoryRepository;
import com.lbos.commercecustomer.repository.ProductRepository;
import com.lbos.commercecustomer.service.impl.CatalogueServiceImpl;
import com.lbos.commercecustomer.service.impl.ContextSupport;
import com.lbos.commercecustomer.service.impl.FeignCallSupport;
import com.lbos.commercecustomer.service.impl.InventoryServiceImpl;
import com.lbos.commercecustomer.service.impl.ProductDiscoveryServiceImpl;
import com.lbos.commercecustomer.service.impl.RetailerEnrichmentSupport;

/**
 * The paged product lists (retailer catalogue, retailer inventory, customer discovery) always ask for an explicit order.
 * Without one PostgreSQL returns rows in whatever physical order they happen to be stored, and an UPDATE (for example a
 * stock adjustment) moves a row - so the list reshuffled after each change and a page boundary could repeat or skip a product.
 */
class ProductListOrderTest {

    @SuppressWarnings("unchecked")
    private Sort sortAskedFor(ProductRepository repo) {
        ArgumentCaptor<Pageable> page = ArgumentCaptor.forClass(Pageable.class);
        verify(repo).findAll(any(Specification.class), page.capture());
        return page.getValue().getSort();
    }

    @SuppressWarnings("unchecked")
    private ProductRepository repoReturningOnePage() {
        ProductRepository repo = mock(ProductRepository.class);
        Page<Product> empty = new PageImpl<>(List.of());
        when(repo.findAll(any(Specification.class), any(Pageable.class))).thenReturn(empty);
        return repo;
    }

    private ContextSupport retailerContext() {
        ContextSupport ctx = mock(ContextSupport.class);
        when(ctx.retailer()).thenReturn(new RetailerContextResponse(UUID.randomUUID(), UUID.randomUUID(), "Store", UUID.randomUUID()));
        return ctx;
    }

    @Test
    void theRetailerCatalogueIsListedInAStableOrder() {
        ProductRepository repo = repoReturningOnePage();
        new CatalogueServiceImpl(repo, mock(ProductCategoryRepository.class), mock(CustomerWishlistItemRepository.class),
                mock(CustomerCartRepository.class), mock(CustomerReviewRepository.class), retailerContext(), new CommerceMapper())
                .search(null, null, null, null, 0, 50);

        assertEquals(Sort.by("id"), sortAskedFor(repo));
    }

    @Test
    void theRetailerInventoryIsListedInAStableOrder() {
        ProductRepository repo = repoReturningOnePage();
        new InventoryServiceImpl(repo, retailerContext(), new CommerceMapper()).search(null, null, null, 0, 50);

        assertEquals(Sort.by("id"), sortAskedFor(repo));
    }

    @Test
    void theCustomerProductListIsInAStableOrder() {
        ProductRepository repo = repoReturningOnePage();
        PartnerVerificationClient partners = mock(PartnerVerificationClient.class);
        when(partners.openRetailerIds()).thenReturn(List.of(UUID.randomUUID()));
        new ProductDiscoveryServiceImpl(repo, new CommerceMapper(), new RetailerEnrichmentSupport(partners, new FeignCallSupport()))
                .search(null, null, null, null, null, 0, 20);

        assertEquals(Sort.by("id"), sortAskedFor(repo));
    }
}
