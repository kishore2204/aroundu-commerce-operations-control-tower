package com.lbos.finance.repository;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.lbos.finance.entity.TaxConfiguration;
public interface TaxConfigurationRepository extends JpaRepository<TaxConfiguration, UUID> {
    /** Configurations in force on a date for the given categories in one state (or nationwide) - one query for a whole basket. */
    @Query("select t from TaxConfiguration t where t.productCategoryId in :categoryIds and t.active = true "
            + "and (t.stateId = :stateId or t.stateId is null) "
            + "and (t.effectiveFrom is null or t.effectiveFrom <= :on) and (t.effectiveTo is null or t.effectiveTo >= :on)")
    List<TaxConfiguration> findApplicable(@Param("categoryIds") Collection<Long> categoryIds, @Param("stateId") UUID stateId, @Param("on") LocalDate on);
    List<TaxConfiguration> findByProductCategoryIdAndActiveTrue(Long productCategoryId);
    /** Every rule of a category (any state, any period, active or not). */
    List<TaxConfiguration> findByProductCategoryId(Long productCategoryId);
    List<TaxConfiguration> findByProductCategoryIdIsNull();
}
