package com.unihop.ride;

import com.unihop.common.enums.RideStatus;
import com.unihop.pricing.FareBreakdown;

import java.time.Instant;
import java.util.UUID;

/** One {@code rides} row. */
public record RideRow(
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
        String cancelledBy,
        Instant scheduledFor
) {

    /** True while a scheduled ride's time has not come yet; matching waits until then. */
    public boolean isScheduledLater(Instant now) {
        return scheduledFor != null && scheduledFor.isAfter(now);
    }

    public boolean isParticipant(UUID userId) {
        return userId.equals(riderId) || userId.equals(driverId);
    }
}
