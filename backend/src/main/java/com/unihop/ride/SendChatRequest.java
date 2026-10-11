package com.unihop.ride;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of {@code POST /api/rides/{id}/chat}. */
public record SendChatRequest(@NotBlank @Size(max = 1000) String body) {
}
