package com.unihop.assistant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AssistantCommandRequest(
        @NotBlank @Size(max = 500) String message
) {
}
