package com.unihop.assistant;

import com.unihop.common.ApiException;
import com.unihop.common.enums.AssistantAction;
import com.unihop.common.enums.UserMode;
import com.unihop.user.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class AssistantService {

    private static final int MAX_REPLY_LENGTH = 500;

    private final UserService users;
    private final AssistantHubCatalog hubCatalog;
    private final AssistantGateway gateway;

    public AssistantService(UserService users, AssistantHubCatalog hubCatalog, AssistantGateway gateway) {
        this.users = users;
        this.hubCatalog = hubCatalog;
        this.gateway = gateway;
    }

    public AssistantCommand command(UUID userId, String rawMessage) {
        String message = rawMessage == null ? "" : rawMessage.trim();
        if (message.isEmpty() || message.length() > 500) {
            throw ApiException.badRequest("VALIDATION_ERROR", "Message must contain 1-500 characters");
        }

        UserMode mode = users.get(userId).mode();
        List<AssistantHub> hubs = hubCatalog.all();
        AssistantDecision decision;
        try {
            decision = gateway.interpret(message, mode, hubs);
        } catch (AssistantProviderException e) {
            throw unavailable();
        }
        return validate(decision, mode, hubs);
    }

    private AssistantCommand validate(AssistantDecision decision, UserMode mode, List<AssistantHub> hubs) {
        if (decision == null || decision.action() == null || decision.reply() == null
                || decision.reply().isBlank() || decision.reply().length() > MAX_REPLY_LENGTH) {
            throw unavailable();
        }

        String reply = decision.reply().trim();
        if (decision.action() == AssistantAction.HELP) {
            return new AssistantCommand(AssistantAction.HELP, reply, null, null);
        }
        if (decision.action() == AssistantAction.STOP_WATCHING) {
            return mode == UserMode.DRIVER
                    ? new AssistantCommand(AssistantAction.STOP_WATCHING, reply, null, null)
                    : help("Switch to driver mode to manage a ride watch.");
        }
        if (decision.action() == AssistantAction.BOOK_RIDE && mode != UserMode.RIDER) {
            return help("Switch to rider mode to book a ride.");
        }
        if (decision.action() == AssistantAction.WATCH_RIDES && mode != UserMode.DRIVER) {
            return help("Switch to driver mode to watch for rides.");
        }

        Map<UUID, AssistantHub> byId = hubs.stream().collect(Collectors.toMap(AssistantHub::id, Function.identity()));
        UUID pickupId = parseKnownHub(decision.pickupHubId(), byId);
        UUID dropoffId = parseKnownHub(decision.dropoffHubId(), byId);

        if (decision.action() == AssistantAction.BOOK_RIDE) {
            if (pickupId == null || dropoffId == null) throw unavailable();
            if (pickupId.equals(dropoffId)) {
                return help("Pickup and drop-off need to be different campus hubs.");
            }
            return new AssistantCommand(AssistantAction.BOOK_RIDE, reply, pickupId, dropoffId);
        }
        if (decision.action() == AssistantAction.WATCH_RIDES) {
            if (decision.pickupHubId() != null || dropoffId == null) throw unavailable();
            return new AssistantCommand(AssistantAction.WATCH_RIDES, reply, null, dropoffId);
        }
        throw unavailable();
    }

    private UUID parseKnownHub(String value, Map<UUID, AssistantHub> hubs) {
        if (value == null) return null;
        try {
            UUID id = UUID.fromString(value);
            return hubs.containsKey(id) ? id : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private AssistantCommand help(String reply) {
        return new AssistantCommand(AssistantAction.HELP, reply, null, null);
    }

    private ApiException unavailable() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "ASSISTANT_UNAVAILABLE",
                "Claude couldn't understand that request right now. Please try again.");
    }
}
