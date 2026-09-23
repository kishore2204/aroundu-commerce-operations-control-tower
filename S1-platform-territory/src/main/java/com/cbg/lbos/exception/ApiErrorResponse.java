package com.cbg.lbos.exception;
import java.time.OffsetDateTime; import java.util.Map;
/** Common JSON API error response. */
public record ApiErrorResponse(OffsetDateTime timestamp,int status,String error,String message,String path,Map<String,String> validationErrors) {}
