package com.unihop.ride;

import com.unihop.common.enums.RideStatus;
import com.unihop.pricing.FareBreakdown;

import java.time.Instant;
import java.util.UUID;

/** One {@code rides} row. */
record RideRow(
        UUID id,
        UUID riderId,
        UUID driverId,
        UUID pickupHubId,
        UUID dropoffHubId,
        RideStatus status,
        FareBreakdown fare,
        String pin,
        String shareToken,
        Instant requestedAt,
        Instant acceptedAt,
        Instant arrivedAt,
        Instant startedAt,
        Instant completedAt,
        Instant cancelledAt,
        String cancelReason,
        String cancelledBy
) {

    boolean isParticipant(UUID userId) {
        return userId.equals(riderId) || userId.equals(driverId);
    }
}
