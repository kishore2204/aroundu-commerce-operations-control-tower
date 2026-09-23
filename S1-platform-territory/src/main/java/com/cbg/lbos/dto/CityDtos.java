package com.cbg.lbos.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * The nested record names here (CreateRequest/UpdateRequest/Response) previously collided with
 * OperationsManagerDtos' identically-named records: springdoc-openapi keys OpenAPI component
 * schemas by simple class name, so both controllers resolved to the same schema entry and
 * Swagger UI showed City's create/update endpoints with Operations Manager's request/response
 * shape. The @Schema(name=...) annotations give each record a distinct component name.
 */
public final class CityDtos {
    private CityDtos() {
    }

    @Schema(name = "CityCreateRequest")
    public record CreateRequest(
            @NotNull(message = "State ID is required") UUID stateId,
            @NotBlank(message = "City name is required")
            @Size(max = 100, message = "City name must not exceed 100 characters") String cityName) {
    }

    @Schema(name = "CityUpdateRequest")
    public record UpdateRequest(
            @NotNull(message = "State ID is required") UUID stateId,
            @NotBlank(message = "City name is required")
            @Size(max = 100, message = "City name must not exceed 100 characters") String cityName,
            Boolean active) {
    }

    @Schema(name = "CityResponse")
    public record Response(
            UUID id,
            String cityName,
            UUID stateId,
            String stateName,
            Boolean active) {
    }
}
