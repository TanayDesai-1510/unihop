package com.unihop.ride;

import java.util.UUID;

/** Published inside the ride-creation transaction; matching listens after commit. */
public record RideRequestedEvent(UUID rideId) {
}
