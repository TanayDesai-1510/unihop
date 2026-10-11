package com.unihop.records;

import com.unihop.common.enums.RideStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Contract DTO used by ride history and driver earnings. */
public record RideSummary(
        UUID id,
        RideStatus status,
        String pickupHubName,
        String dropoffHubName,
        BigDecimal total,
        BigDecimal driverPayout,
        Instant completedAt,
        Instant requestedAt
) {
}
