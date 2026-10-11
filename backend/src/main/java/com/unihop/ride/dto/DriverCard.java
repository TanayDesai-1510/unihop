package com.unihop.ride.dto;

import java.math.BigDecimal;
import java.util.UUID;

/** Contract DTO {@code DriverCard} (section 9). {@code lat}/{@code lng} are null until the driver reports a location. */
public record DriverCard(
        UUID id,
        String name,
        BigDecimal ratingAvg,
        String carMake,
        String carModel,
        String carColor,
        String plate,
        Double lat,
        Double lng
) {
}
