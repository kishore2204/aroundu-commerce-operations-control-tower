package com.lbos.commercecustomer.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

/** The product search boxes (retailer catalogue and customer discovery) build their LIKE pattern here. */
class ProductSearchPatternTest {

    @Test
    void surroundingSpacesAreIgnoredAndCaseIsFolded() {
        assertEquals("%rice%", ProductSpecifications.containsPattern("  RiCe "));
        assertEquals("%sona masoori%", ProductSpecifications.containsPattern("Sona Masoori "));
    }

    @Test
    void likeWildcardsTypedByTheUserAreTakenLiterally() {
        assertEquals("%50\\%%", ProductSpecifications.containsPattern("50%"));
        assertEquals("%\\%%", ProductSpecifications.containsPattern("%"));
        assertEquals("%a\\_b%", ProductSpecifications.containsPattern("a_b"));
    }

    @Test
    void theEscapeCharacterItselfIsEscaped() {
        assertEquals("%a\\\\b%", ProductSpecifications.containsPattern("a\\b"));
    }
}
