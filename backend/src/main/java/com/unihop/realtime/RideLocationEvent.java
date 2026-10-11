package com.unihop.realtime;

/**
 * Contract section 11: payload of {@code /topic/rides/{rideId}/location}.
 * {@code heading} is degrees 0-360 clockwise from north; {@code etaSeconds} is to pickup while ACCEPTED, to dropoff while IN_PROGRESS.
 */
public record RideLocationEvent(
        double lat,
        double lng,
        double heading,
        int etaSeconds
) {
}
