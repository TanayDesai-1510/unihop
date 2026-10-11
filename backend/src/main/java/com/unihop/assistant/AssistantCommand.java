package com.unihop.assistant;

import com.unihop.common.enums.AssistantAction;

import java.util.UUID;

public record AssistantCommand(
        AssistantAction action,
        String reply,
        UUID pickupHubId,
        UUID dropoffHubId
) {
}
