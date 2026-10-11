package com.unihop.ride.dto;

import java.time.Instant;
import java.util.UUID;

/** Contract DTO {@code ChatMessage} (section 9, stretch). */
public record ChatMessage(
        UUID id,
        UUID senderId,
        String body,
        Instant createdAt
) {
}
