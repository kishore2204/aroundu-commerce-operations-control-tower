package com.lbos.commercecustomer.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.lbos.commercecustomer.entity.ProductCategory;
import com.lbos.commercecustomer.enums.CategoryStatus;
import com.lbos.commercecustomer.exception.BusinessValidationException;
import com.lbos.commercecustomer.exception.ResourceNotFoundException;
import com.lbos.commercecustomer.mapper.CommerceMapper;
import com.lbos.commercecustomer.repository.ProductCategoryRepository;
import com.lbos.commercecustomer.repository.ProductRepository;
import com.lbos.commercecustomer.service.CategoryService.CategoryResolution;
import com.lbos.commercecustomer.service.impl.CategoryServiceImpl;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

/** The admin's "new tax rule" flow: a typed category name is reused when it exists, otherwise created ACTIVE. */
class CategoryResolveByNameTest {

    private final ProductCategoryRepository repository = mock(ProductCategoryRepository.class);
    private final CategoryServiceImpl service = new CategoryServiceImpl(repository, mock(ProductRepository.class), new CommerceMapper());

    private ProductCategory category(Long id, String name, CategoryStatus status) {
        ProductCategory category = new ProductCategory();
        category.setId(id);
        category.setName(name);
        category.setStatus(status);
        return category;
    }

    @Test
    void anExistingCategoryIsReusedWhateverTheCasingOrSpacing() {
        when(repository.findFirstByNameIgnoreCase("GROCERIES")).thenReturn(Optional.of(category(7L, "Groceries", CategoryStatus.ACTIVE)));

        CategoryResolution resolution = service.resolveByName("  GROCERIES ", true);

        assertFalse(resolution.created());
        assertEquals(7L, resolution.category().id());
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void innerWhitespaceIsCollapsedSoOrganicFoodsAndOrganicSpaceSpaceFoodsAreTheSameCategory() {
        when(repository.findFirstByNameIgnoreCase("organic foods")).thenReturn(Optional.of(category(9L, "Organic Foods", CategoryStatus.ACTIVE)));

        assertEquals(9L, service.resolveByName("organic   foods", true).category().id());
    }

    @Test
    void aMissingCategoryIsCreatedActiveWithTheNormalisedName() {
        when(repository.findFirstByNameIgnoreCase("Organic Foods")).thenReturn(Optional.empty());
        when(repository.saveAndFlush(any())).thenAnswer(call -> {
            ProductCategory saved = call.getArgument(0);
            saved.setId(21L);
            return saved;
        });

        CategoryResolution resolution = service.resolveByName("  Organic   Foods ", true);

        assertTrue(resolution.created());
        assertEquals(21L, resolution.category().id());
        assertEquals("Organic Foods", resolution.category().name());
        assertEquals(CategoryStatus.ACTIVE, resolution.category().status());
    }

    @Test
    void withoutPermissionToCreateAMissingCategoryIsReportedNotCreated() {
        when(repository.findFirstByNameIgnoreCase("Organic Foods")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.resolveByName("Organic Foods", false));
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void anInactiveCategoryIsNeitherReusedNorDuplicated() {
        when(repository.findFirstByNameIgnoreCase("festive gifting")).thenReturn(Optional.of(category(8L, "Festive Gifting", CategoryStatus.INACTIVE)));

        BusinessValidationException failure = assertThrows(BusinessValidationException.class, () -> service.resolveByName("festive gifting", true));

        assertTrue(failure.getMessage().contains("inactive"));
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void aRacingDuplicateInsertFallsBackToTheCategoryTheOtherRequestCreated() {
        when(repository.findFirstByNameIgnoreCase("Snacks")).thenReturn(Optional.empty(), Optional.of(category(30L, "Snacks", CategoryStatus.ACTIVE)));
        when(repository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("duplicate"));

        CategoryResolution resolution = service.resolveByName("Snacks", true);

        assertFalse(resolution.created());
        assertEquals(30L, resolution.category().id());
    }

    @Test
    void aBlankOrOverlongNameIsRejected() {
        assertThrows(BusinessValidationException.class, () -> service.resolveByName("   ", true));
        assertThrows(BusinessValidationException.class, () -> service.resolveByName(null, true));
        assertThrows(BusinessValidationException.class, () -> service.resolveByName("x".repeat(101), true));
    }
}
