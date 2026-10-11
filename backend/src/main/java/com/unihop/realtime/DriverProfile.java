package com.unihop.realtime;

import com.unihop.common.enums.DriverStatus;

import java.util.UUID;

/** Contract DTO {@code DriverProfile} (section 9). {@code lat}/{@code lng} are null until the driver reports a location. */
public record DriverProfile(
        UUID userId,
        String licenseNumber,
        String carMake,
        String carModel,
        String carColor,
        String plate,
        DriverStatus status,
        boolean isOnline,
        Double lat,
        Double lng
) {
}
