package com.unihop.ride.dto;

import java.math.BigDecimal;
import java.util.UUID;

/** Contract DTO {@code RideParticipant} (section 9). */
public record RideParticipant(UUID id, String name, BigDecimal ratingAvg) {
}
