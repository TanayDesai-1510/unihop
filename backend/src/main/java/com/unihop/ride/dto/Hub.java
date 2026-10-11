package com.unihop.ride.dto;

import com.unihop.common.enums.Zone;

import java.util.UUID;

/** Contract DTO {@code Hub} (section 9), as embedded in rides and offers. */
public record Hub(
        UUID id,
        String code,
        String name,
        Zone zone,
        double lat,
        double lng
) {
}
