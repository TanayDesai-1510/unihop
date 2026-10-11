package com.unihop.realtime;

import java.util.UUID;

/** Whether a user may follow a ride's topics: its rider or its assigned driver. */
@FunctionalInterface
public interface RideAccess {

    boolean isParticipant(UUID rideId, UUID userId);
}
