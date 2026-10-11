package com.unihop.matching;

import com.unihop.pricing.FareBreakdown;
import com.unihop.ride.dto.Hub;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Contract DTO {@code RideOffer} (section 9). Pushed on {@code /topic/drivers/{driverId}/offers}. */
public record RideOffer(
        UUID offerId,
        UUID rideId,
        Hub pickupHub,
        Hub dropoffHub,
        FareBreakdown fare,
        String riderName,
        BigDecimal riderRating,
        long distanceToPickupMeters,
        Instant expiresAt
) {
}
