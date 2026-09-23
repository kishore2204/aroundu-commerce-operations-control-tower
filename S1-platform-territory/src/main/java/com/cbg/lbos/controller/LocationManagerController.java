package com.cbg.lbos.controller;
import java.util.UUID; import org.springframework.data.domain.*; import org.springframework.data.web.PageableDefault; import org.springframework.http.*; import org.springframework.security.core.Authentication; import org.springframework.web.bind.annotation.*; import com.cbg.lbos.dto.CreateOfficerRequestDto; import com.cbg.lbos.dto.LocationManagerDto; import com.cbg.lbos.entity.AssignmentStatus; import com.cbg.lbos.service.LocationManagerService; import jakarta.validation.Valid;
@RestController @RequestMapping("/api/v1/location-managers")
public class LocationManagerController {
 private final LocationManagerService service; public LocationManagerController(LocationManagerService service){this.service=service;}
 /** Creates an assignment. */ @PostMapping public ResponseEntity<LocationManagerDto> create(@Valid @RequestBody LocationManagerDto dto){return ResponseEntity.status(HttpStatus.CREATED).body(service.assignLocationManager(dto));}
 /** An Operations Manager creating a new officer under themselves in one step - see
  *  CreateOfficerRequestDto and LocationManagerService.createOfficer. Matched before "/{id}". */
 @PostMapping("/officers") public ResponseEntity<LocationManagerDto> createOfficer(@Valid @RequestBody CreateOfficerRequestDto request, Authentication authentication){return ResponseEntity.status(HttpStatus.CREATED).body(service.createOfficer(request, UUID.fromString(authentication.getName())));}
 /** Self-lookup: the authenticated Location Manager's own assignment (city/zone) - matched
  *  before "/{id}" by Spring MVC's more-specific-first rule. */
 @GetMapping("/me") public ResponseEntity<LocationManagerDto> me(Authentication authentication){return ResponseEntity.ok(service.getByUserAccountId(UUID.fromString(authentication.getName())));}
 /** Gets one assignment. */ @GetMapping("/{id}") public ResponseEntity<LocationManagerDto> get(@PathVariable UUID id){return ResponseEntity.ok(service.getLocationManagerById(id));}
 /** Every active officer of a Zone (a zone may have several Location Managers). */ @GetMapping("/active/by-zone/{zoneId}/all") public ResponseEntity<java.util.List<LocationManagerDto>> activeAllByZone(@PathVariable UUID zoneId){return ResponseEntity.ok(service.getActiveLocationManagersByZone(zoneId));}
 /** Gets ONE active officer of a Zone (the longest-serving). */ @GetMapping("/active/by-zone/{zoneId}") public ResponseEntity<LocationManagerDto> activeByZone(@PathVariable UUID zoneId){return ResponseEntity.ok(service.getActiveLocationManagerByZone(zoneId));}
 /** Searches assignments. */ @GetMapping public ResponseEntity<Page<LocationManagerDto>> list(@RequestParam(required=false) UUID zoneId,@RequestParam(required=false) UUID operationsManagerId,@RequestParam(required=false) AssignmentStatus status,@PageableDefault(size=20,sort="assignedAt") Pageable pageable){return ResponseEntity.ok(service.getLocationManagers(zoneId,operationsManagerId,status,pageable));}
 /** Transfers an officer. */ @PutMapping("/{id}/transfer") public ResponseEntity<LocationManagerDto> transfer(@PathVariable UUID id,@Valid @RequestBody LocationManagerDto dto){return ResponseEntity.ok(service.transferLocationManager(id,dto));}
 /** Changes the supervisor. */ @PatchMapping("/{id}/operations-manager") public ResponseEntity<LocationManagerDto> changeSupervisor(@PathVariable UUID id,@RequestBody LocationManagerDto dto){return ResponseEntity.ok(service.changeOperationsManager(id,dto));}
 /** Eligible Location Managers (active, same state) to take over this officer's pending work. */ @GetMapping("/{id}/transfer-candidates") public ResponseEntity<java.util.List<LocationManagerDto>> transferCandidates(@PathVariable UUID id){return ResponseEntity.ok(service.getTransferCandidates(id));}
 /** Activates an assignment. */ @PatchMapping("/{id}/activate") public ResponseEntity<LocationManagerDto> activate(@PathVariable UUID id){return ResponseEntity.ok(service.activateAssignment(id));}
 /** Deactivates an assignment. */ @PatchMapping("/{id}/deactivate") public ResponseEntity<LocationManagerDto> deactivate(@PathVariable UUID id){return ResponseEntity.ok(service.deactivateAssignment(id));}
}
