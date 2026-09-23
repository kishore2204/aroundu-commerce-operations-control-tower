package com.lbos.finance.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.lbos.finance.entity.TicketClusterIncident;

/**
 * Spring Data JPA repository for {@link TicketClusterIncident} records, providing the
 * lookups used by the clustering sweep (find an already-open incident for a cluster key,
 * list what is currently active) and by the staff-facing insight endpoint.
 */
public interface TicketClusterIncidentRepository extends JpaRepository<TicketClusterIncident, UUID> {

    /**
     * Lists incidents in a given status, newest last-seen first.
     *
     * @param incidentStatus the status to match ("ACTIVE" or "RESOLVED")
     * @return the matching incidents, most recently seen first
     */
    List<TicketClusterIncident> findByIncidentStatusOrderByLastSeenAtDesc(String incidentStatus);

    /**
     * Finds the open incident for a specific cluster key, so a re-detected cluster updates the
     * existing record instead of creating a duplicate on every sweep. Sub-category is matched
     * through the derived "territoryKey + category + subCategory" triple; a null sub-category
     * is normalised to a placeholder by the sweep so this stays a plain equality match.
     *
     * @param ticketCategory the ticket category
     * @param ticketSubCategory the ticket sub-category
     * @param territoryKey the territory key ("ZONE:&lt;uuid&gt;" or "CITY:&lt;uuid&gt;")
     * @param incidentStatus the status to match (normally "ACTIVE")
     * @return the matching incident, if one exists
     */
    Optional<TicketClusterIncident> findByTicketCategoryAndTicketSubCategoryAndTerritoryKeyAndIncidentStatus(
            String ticketCategory, String ticketSubCategory, String territoryKey, String incidentStatus);
}
