package com.unihop.records;

import com.unihop.payments.PaymentSummary;
import com.unihop.pricing.FareBreakdown;

import java.time.Instant;
import java.util.UUID;

/** Contract DTO for a completed ride receipt. */
public record Receipt(
        UUID rideId,
        String pickupHubName,
        String dropoffHubName,
        FareBreakdown fare,
        PaymentSummary payment,
        String driverName,
        String riderName,
        Instant startedAt,
        Instant completedAt,
        Long durationSeconds
) {
}
