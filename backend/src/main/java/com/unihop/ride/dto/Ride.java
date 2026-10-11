package com.unihop.ride.dto;

import com.unihop.common.enums.RideStatus;
import com.unihop.payments.PaymentSummary;
import com.unihop.pricing.FareBreakdown;

import java.time.Instant;
import java.util.UUID;

/** Contract DTO {@code Ride} (section 9). {@code pin} is only ever set for the rider. */
public record Ride(
        UUID id,
        RideStatus status,
        PaymentSummary payment,
        RideParticipant rider,
        DriverCard driver,
        Hub pickupHub,
        Hub dropoffHub,
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
}
