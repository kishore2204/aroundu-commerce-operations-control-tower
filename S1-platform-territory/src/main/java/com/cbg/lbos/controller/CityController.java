package com.cbg.lbos.controller;

import java.net.URI;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.cbg.lbos.dto.CityDtos.CreateRequest;
import com.cbg.lbos.dto.CityDtos.Response;
import com.cbg.lbos.dto.CityDtos.UpdateRequest;
import com.cbg.lbos.service.CityService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/cities")
public class CityController {
    private final CityService cityService;

    public CityController(CityService cityService) {
        this.cityService = cityService;
    }

    @GetMapping
    public Page<Response> list(
            @RequestParam(required = false) Boolean active,
            @PageableDefault(size = 50, sort = "cityName") Pageable pageable) {
        return cityService.list(active, pageable);
    }

    @GetMapping("/{id}")
    public Response get(@PathVariable UUID id) {
        return cityService.get(id);
    }

    @PostMapping
    public ResponseEntity<Response> create(@Valid @RequestBody CreateRequest request) {
        Response createdCity = cityService.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(createdCity.id())
                .toUri();
        return ResponseEntity.created(location).body(createdCity);
    }

    @PutMapping("/{id}")
    public Response update(@PathVariable UUID id, @Valid @RequestBody UpdateRequest request) {
        return cityService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        cityService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/activate")
    public Response activate(@PathVariable UUID id) {
        return cityService.activate(id);
    }

    @PatchMapping("/{id}/deactivate")
    public Response deactivate(@PathVariable UUID id) {
        return cityService.deactivate(id);
    }
}
