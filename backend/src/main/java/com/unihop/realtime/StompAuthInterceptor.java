package com.unihop.realtime;

import com.unihop.common.ApiException;
import com.unihop.common.CurrentUser;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;

import java.security.Principal;
import java.util.UUID;

/**
 * Contract section 11 auth for inbound STOMP frames.
 * <ul>
 *   <li>CONNECT: {@code Authorization: Bearer <jwt>}, or {@code X-Demo-User: <uuid>} when demo headers are enabled.
 *       A bearer header always wins, same as {@link CurrentUser}.</li>
 *   <li>SUBSCRIBE: only under {@code /topic/}; a driver's offer topic only by that driver; a ride's topics
 *       ({@code /topic/rides/{id}/status|location|chat}) only by its rider or assigned driver.</li>
 *   <li>SEND: rejected. Clients only subscribe.</li>
 * </ul>
 * Rejections throw, which makes Spring answer with a STOMP ERROR frame and close the session.
 */
public class StompAuthInterceptor implements ChannelInterceptor {

    private static final String AUTHORIZATION = "Authorization";
    private static final String BEARER = "Bearer ";

    private final StompTokenVerifier tokenVerifier;
    private final boolean demoHeaderEnabled;
    private final RideAccess rideAccess;

    public StompAuthInterceptor(StompTokenVerifier tokenVerifier, boolean demoHeaderEnabled, RideAccess rideAccess) {
        this.tokenVerifier = tokenVerifier;
        this.demoHeaderEnabled = demoHeaderEnabled;
        this.rideAccess = rideAccess;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }
        StompCommand command = accessor.getCommand();
        if (command == StompCommand.CONNECT) {
            accessor.setUser(new StompUser(authenticate(accessor)));
        } else if (command == StompCommand.SUBSCRIBE) {
            checkSubscription(accessor);
        } else if (command == StompCommand.SEND) {
            throw new MessageDeliveryException("Clients only subscribe; SEND is not supported");
        }
        return message;
    }

    UUID authenticate(StompHeaderAccessor accessor) {
        String authorization = accessor.getFirstNativeHeader(AUTHORIZATION);
        if (authorization != null) {
            if (!authorization.regionMatches(true, 0, BEARER, 0, BEARER.length())
                    || authorization.substring(BEARER.length()).isBlank()) {
                throw new MessageDeliveryException("Invalid access token");
            }
            try {
                return tokenVerifier.subject(authorization.substring(BEARER.length()).trim());
            } catch (ApiException e) {
                throw new MessageDeliveryException(e.getMessage());
            }
        }
        String demoUser = demoHeaderEnabled ? accessor.getFirstNativeHeader(CurrentUser.DEMO_HEADER) : null;
        if (demoUser != null && !demoUser.isBlank()) {
            try {
                return UUID.fromString(demoUser.trim());
            } catch (IllegalArgumentException e) {
                throw new MessageDeliveryException(CurrentUser.DEMO_HEADER + " must be a user UUID");
            }
        }
        throw new MessageDeliveryException("Authentication required");
    }

    private void checkSubscription(StompHeaderAccessor accessor) {
        if (!(accessor.getUser() instanceof StompUser user)) {
            throw new MessageDeliveryException("Authentication required");
        }
        String destination = accessor.getDestination();
        if (destination == null || !destination.startsWith(Topics.PREFIX + "/")) {
            throw new MessageDeliveryException("Unknown destination " + destination);
        }
        UUID offerOwner = Topics.driverOfOffersTopic(destination);
        if (offerOwner != null && !offerOwner.equals(user.id())) {
            throw new MessageDeliveryException("Forbidden: not your offer topic");
        }
        UUID rideId = Topics.rideOfRideTopic(destination);
        if (rideId != null && !rideAccess.isParticipant(rideId, user.id())) {
            throw new MessageDeliveryException("Forbidden: not a participant in this ride");
        }
    }

    /** STOMP session principal; {@link #getName()} is the user UUID. */
    public record StompUser(UUID id) implements Principal {
        @Override
        public String getName() {
            return id.toString();
        }
    }
}
