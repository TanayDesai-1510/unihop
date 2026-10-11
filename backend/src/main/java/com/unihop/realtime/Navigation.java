package com.unihop.realtime;

import com.unihop.matching.Haversine;

/** Heading and rough campus-driving ETA for location and status events (contract section 11). */
public final class Navigation {

    /** Average campus driving speed, ~29 km/h. */
    static final double SPEED_METERS_PER_SECOND = 8.0;
    /** Roads are longer than the straight line. */
    static final double ROAD_FACTOR = 1.3;

    private Navigation() {
    }

    /** Seconds to drive from one point to another. */
    public static int etaSeconds(double fromLat, double fromLng, double toLat, double toLng) {
        double meters = Haversine.meters(fromLat, fromLng, toLat, toLng) * ROAD_FACTOR;
        return (int) Math.round(meters / SPEED_METERS_PER_SECOND);
    }

    /** Initial bearing, degrees 0-360 clockwise from north. */
    public static double heading(double fromLat, double fromLng, double toLat, double toLng) {
        double phi1 = Math.toRadians(fromLat);
        double phi2 = Math.toRadians(toLat);
        double dLng = Math.toRadians(toLng - fromLng);
        double y = Math.sin(dLng) * Math.cos(phi2);
        double x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);
        double degrees = Math.toDegrees(Math.atan2(y, x));
        return (degrees + 360) % 360;
    }
}
