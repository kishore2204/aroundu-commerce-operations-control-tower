package com.cbg.lbos.controller;
import java.util.UUID; import org.springframework.data.domain.*; import org.springframework.data.web.PageableDefault; import org.springframework.http.*; import org.springframework.web.bind.annotation.*; import com.cbg.lbos.dto.ZoneDto; import com.cbg.lbos.service.ZoneService; import jakarta.validation.Valid;
@RestController @RequestMapping("/api/v1/zones")
public class ZoneController {
 private final ZoneService service; public ZoneController(ZoneService service){this.service=service;}
 /** Creates a Zone. */ @PostMapping public ResponseEntity<ZoneDto> create(@Valid @RequestBody ZoneDto dto){return ResponseEntity.status(HttpStatus.CREATED).body(service.createZone(dto));}
 /** Gets one Zone. */ @GetMapping("/{id}") public ResponseEntity<ZoneDto> get(@PathVariable UUID id){return ResponseEntity.ok(service.getZoneById(id));}
 /** Searches Zones. */ @GetMapping public ResponseEntity<Page<ZoneDto>> list(@RequestParam(required=false) UUID cityId,@RequestParam(required=false) Boolean active,@PageableDefault(size=20,sort="zoneName") Pageable pageable){return ResponseEntity.ok(service.getZones(cityId,active,pageable));}
 /** Updates a Zone name. */ @PutMapping("/{id}") public ResponseEntity<ZoneDto> update(@PathVariable UUID id,@Valid @RequestBody ZoneDto dto){return ResponseEntity.ok(service.updateZone(id,dto));}
 /** Activates a Zone. */ @PatchMapping("/{id}/activate") public ResponseEntity<ZoneDto> activate(@PathVariable UUID id){return ResponseEntity.ok(service.activateZone(id));}
 /** Deactivates a Zone. */ @PatchMapping("/{id}/deactivate") public ResponseEntity<ZoneDto> deactivate(@PathVariable UUID id){return ResponseEntity.ok(service.deactivateZone(id));}
}
