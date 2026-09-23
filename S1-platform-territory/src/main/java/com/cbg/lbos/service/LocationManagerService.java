package com.cbg.lbos.service;

import java.util.UUID;
import org.springframework.data.domain.*;
import com.cbg.lbos.dto.CreateOfficerRequestDto;
import com.cbg.lbos.dto.LocationManagerDto;
import com.cbg.lbos.entity.AssignmentStatus;

/** Defines Location Manager business operations. */
public interface LocationManagerService {
	/** Creates an active assignment. */
	LocationManagerDto assignLocationManager(LocationManagerDto dto);

	/** Creates a new LOCATION_MANAGER user account and assigns it to the given zone under the
	 *  supervising Operations Manager resolved from creatorUserAccountId - see
	 *  CreateOfficerRequestDto. */
	LocationManagerDto createOfficer(CreateOfficerRequestDto request, java.util.UUID creatorUserAccountId);

	/** Gets one assignment. */
	LocationManagerDto getLocationManagerById(UUID id);

	/** Self-lookup: the most recent assignment for this userAccountId - needed by a Location
	 *  Manager's own session to learn their assigned city/zone (there is no other in-app way,
	 *  GET /api/v1/location-managers itself being staff-only). */
	LocationManagerDto getByUserAccountId(UUID userAccountId);

	/** Gets ONE active officer of a Zone (the longest-serving) - kept for callers that only need any officer of the zone;
	 *  a zone can have several, see {@link #getActiveLocationManagersByZone}. */
	LocationManagerDto getActiveLocationManagerByZone(UUID zoneId);

	/** Every active officer assigned to a Zone (a zone may have several Location Managers), longest-serving first. */
	java.util.List<LocationManagerDto> getActiveLocationManagersByZone(UUID zoneId);

	/** Searches assignments. */
	Page<LocationManagerDto> getLocationManagers(UUID zoneId, UUID operationsManagerId, AssignmentStatus status,
			Pageable pageable);

	/** Transfers an officer to another Zone. */
	LocationManagerDto transferLocationManager(UUID id, LocationManagerDto dto);

	/** Changes the supervising Operations Manager. */
	LocationManagerDto changeOperationsManager(UUID id, LocationManagerDto dto);

	/** Activates an assignment. */
	LocationManagerDto activateAssignment(UUID id);

	/** Deactivates an assignment. */
	LocationManagerDto deactivateAssignment(UUID id);

	/** Active Location Managers in the same state as this officer - the eligible targets for taking over their work. */
	java.util.List<LocationManagerDto> getTransferCandidates(UUID id);

	/** Throws when the account belongs to an ACTIVE Location Manager who still has pending work and the change would
	 *  take them out of service (any status other than ACTIVE). */
	void assertAccountStatusChangeAllowed(UUID userAccountId, String newStatus);
}
