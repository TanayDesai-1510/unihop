package com.unihop.realtime;

import java.util.UUID;

/** Topic names from contract section 11. */
public final class Topics {

    public static final String PREFIX = "/topic";

    private static final String DRIVERS = PREFIX + "/drivers/";
    private static final String OFFERS = "/offers";

    private Topics() {
    }

    public static String driverOffers(UUID driverId) {
        return DRIVERS + driverId + OFFERS;
    }

    public static String rideStatus(UUID rideId) {
        return PREFIX + "/rides/" + rideId + "/status";
    }

    public static String rideLocation(UUID rideId) {
        return PREFIX + "/rides/" + rideId + "/location";
    }

    public static String rideChat(UUID rideId) {
        return PREFIX + "/rides/" + rideId + "/chat";
    }

    /** The driver id if {@code destination} is a driver offers topic, else null. Malformed ids count as nobody's topic. */
    static UUID driverOfOffersTopic(String destination) {
        if (!destination.startsWith(DRIVERS)) {
            return null;
        }
        String rest = destination.substring(DRIVERS.length());
        if (!rest.endsWith(OFFERS)) {
            return null;
        }
        try {
            return UUID.fromString(rest.substring(0, rest.length() - OFFERS.length()));
        } catch (IllegalArgumentException e) {
            return new UUID(0, 0);
        }
    }
}
