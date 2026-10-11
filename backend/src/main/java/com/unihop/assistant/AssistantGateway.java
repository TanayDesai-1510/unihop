package com.unihop.assistant;

import com.unihop.common.enums.UserMode;

import java.util.List;

interface AssistantGateway {
    AssistantDecision interpret(String message, UserMode mode, List<AssistantHub> hubs);
}
