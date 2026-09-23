package com.cbg.lbos.util;

import java.math.BigDecimal;

/**
 * Great-circle distance between two lat/long points, used to find the nearest available
 * vehicle/driver to a delivery address (see VehicleServiceImpl/DriverServiceImpl.
 * nearestAvailable()). No spatial index/DB-side geo query is used anywhere in this system -
 * the active-vehicle/driver sets are small enough at this project's scale for an in-memory
 * sort to be the pragmatic choice, matching how the rest of this codebase already avoids
 * infrastructure the training/demo scope doesn't call for.
 */
public final class HaversineDistance {

    private static final double EARTH_RADIUS_KM = 6371.0;

    private HaversineDistance() {
    }

    public static double km(BigDecimal lat1, BigDecimal lon1, BigDecimal lat2, BigDecimal lon2) {
        if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
            return Double.MAX_VALUE;
        }
        double phi1 = Math.toRadians(lat1.doubleValue());
        double phi2 = Math.toRadians(lat2.doubleValue());
        double deltaPhi = Math.toRadians(lat2.doubleValue() - lat1.doubleValue());
        double deltaLambda = Math.toRadians(lon2.doubleValue() - lon1.doubleValue());

        double a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2)
                + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_KM * c;
    }
}
