package com.unihop.ride;

import jakarta.validation.constraints.NotBlank;

/** Body of {@code POST /api/rides/{id}/start}. */
public record StartRideRequest(@NotBlank String pin) {
}
