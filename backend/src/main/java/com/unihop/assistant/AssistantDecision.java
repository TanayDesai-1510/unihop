package com.unihop.assistant;

import com.unihop.common.enums.AssistantAction;

record AssistantDecision(
        AssistantAction action,
        String reply,
        String pickupHubId,
        String dropoffHubId
) {
}
