package com.unihop.ride;

import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

/** Body of {@code POST /api/rides} (contract section 8). */
public record CreateRideRequest(
        @NotNull UUID pickupHubId,
        @NotNull UUID dropoffHubId,
        UUID paymentMethodId,
        Boolean useCredits,
        String promoCode,
        Instant scheduledFor
) {
}
