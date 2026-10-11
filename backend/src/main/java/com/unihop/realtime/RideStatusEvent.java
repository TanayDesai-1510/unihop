package com.unihop.realtime;

import com.unihop.common.enums.RideStatus;
import com.unihop.ride.dto.DriverCard;

import java.time.Instant;
import java.util.UUID;

/** Contract section 11: payload of {@code /topic/rides/{rideId}/status}. */
public record RideStatusEvent(
        UUID rideId,
        RideStatus status,
        DriverCard driver,
        Integer etaSeconds,
        Instant updatedAt
) {
}
