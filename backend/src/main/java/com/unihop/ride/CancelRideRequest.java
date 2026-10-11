package com.unihop.ride;

import jakarta.validation.constraints.Size;

/** Body of {@code POST /api/rides/{id}/cancel}. */
public record CancelRideRequest(@Size(max = 255) String reason) {
}
