package com.lbos.finance.dto;

/**
 * What one run of the ticket-clustering sweep did.
 *
 * @param ticketsScanned how many still-live tickets were inside the detection window
 * @param ticketsWithResolvedTerritory how many of those had a city/zone that could be resolved
 * @param clustersDetected how many (category, sub-category, territory) groups met the threshold
 * @param incidentsOpened how many of those clusters were newly recorded as incidents
 * @param incidentsUpdated how many refreshed an already-active incident
 * @param incidentsResolved how many previously-active incidents no longer met the threshold
 * @param ticketsPriorityBumped how many LOW/MEDIUM tickets had their priority raised
 */
public record TicketClusterSweepSummary(int ticketsScanned, int ticketsWithResolvedTerritory,
        int clustersDetected, int incidentsOpened, int incidentsUpdated, int incidentsResolved,
        int ticketsPriorityBumped) { }
