package com.unihop.ride.dto;

import com.unihop.common.enums.RideStatus;

import java.time.Instant;

/** Contract DTO {@code PublicRideView} (section 9, stretch): what a shared trip link shows. No PIN, payment or full name. */
public record PublicRideView(
        RideStatus status,
        Hub pickupHub,
        Hub dropoffHub,
        DriverCard driver,
        String riderFirstName,
        Integer etaSeconds,
        Instant updatedAt
) {
}
