package com.cbg.lbos.service;

import java.util.UUID;
import org.springframework.data.domain.*;
import com.cbg.lbos.dto.ZoneDto;

/** Defines Zone business operations. */
public interface ZoneService {
	/** Creates an active Zone. */
	ZoneDto createZone(ZoneDto dto);

	/** Gets one Zone. */
	ZoneDto getZoneById(UUID id);

	/** Searches Zones. */
	Page<ZoneDto> getZones(UUID cityId, Boolean active, Pageable pageable);

	/** Updates a Zone name. */
	ZoneDto updateZone(UUID id, ZoneDto dto);

	/** Activates a Zone. */
	ZoneDto activateZone(UUID id);

	/** Deactivates a Zone. */
	ZoneDto deactivateZone(UUID id);
}
