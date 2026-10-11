package com.unihop.realtime;

import com.unihop.common.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StompAuthInterceptorTest {

    static final UUID RIDER1 = UUID.fromString("00000000-0000-0000-0000-000000000101");
    static final UUID DRIVER1 = UUID.fromString("00000000-0000-0000-0000-000000000201");
    static final UUID DRIVER2 = UUID.fromString("00000000-0000-0000-0000-000000000202");

    /** Accepts exactly the token "good-token" as DRIVER1. */
    static final StompTokenVerifier VERIFIER = token -> {
        if (token.equals("good-token")) {
            return DRIVER1;
        }
        throw ApiException.unauthorized("Invalid access token");
    };

    /** RIDE belongs to RIDER1 with DRIVER1 assigned. */
    static final UUID RIDE = UUID.fromString("00000000-0000-0000-0000-00000000aaaa");
    static final RideAccess ACCESS = (rideId, userId) -> rideId.equals(RIDE)
            && (userId.equals(RIDER1) || userId.equals(DRIVER1));

    final StompAuthInterceptor demoOn = new StompAuthInterceptor(VERIFIER, true, ACCESS);
    final StompAuthInterceptor demoOff = new StompAuthInterceptor(VERIFIER, false, ACCESS);

    @Test
    void connectWithValidBearerSetsUser() {
        assertThat(userAfterConnect(demoOn, "Authorization", "Bearer good-token")).isEqualTo(DRIVER1);
        assertThat(userAfterConnect(demoOff, "Authorization", "bearer good-token")).isEqualTo(DRIVER1);
    }

    @Test
    void connectWithBadBearerIsRejectedEvenWithDemoHeader() {
        StompHeaderAccessor connect = StompHeaderAccessor.create(StompCommand.CONNECT);
        connect.addNativeHeader("Authorization", "Bearer forged");
        connect.addNativeHeader("X-Demo-User", RIDER1.toString());
        assertThatThrownBy(() -> send(demoOn, connect)).isInstanceOf(MessageDeliveryException.class);
        assertThatThrownBy(() -> userAfterConnect(demoOn, "Authorization", "Basic abc"))
                .isInstanceOf(MessageDeliveryException.class);
        assertThatThrownBy(() -> userAfterConnect(demoOn, "Authorization", "Bearer "))
                .isInstanceOf(MessageDeliveryException.class);
    }

    @Test
    void demoHeaderOnlyWhenEnabled() {
        assertThat(userAfterConnect(demoOn, "X-Demo-User", RIDER1.toString())).isEqualTo(RIDER1);
        assertThatThrownBy(() -> userAfterConnect(demoOff, "X-Demo-User", RIDER1.toString()))
                .isInstanceOf(MessageDeliveryException.class);
        assertThatThrownBy(() -> userAfterConnect(demoOn, "X-Demo-User", "not-a-uuid"))
                .isInstanceOf(MessageDeliveryException.class);
    }

    @Test
    void connectWithoutCredentialsIsRejected() {
        assertThatThrownBy(() -> send(demoOn, StompHeaderAccessor.create(StompCommand.CONNECT)))
                .isInstanceOf(MessageDeliveryException.class);
    }

    @Test
    void driverCanOnlySubscribeToOwnOfferTopic() {
        send(demoOn, subscribe(DRIVER1, Topics.driverOffers(DRIVER1)));
        assertThatThrownBy(() -> send(demoOn, subscribe(DRIVER1, Topics.driverOffers(DRIVER2))))
                .isInstanceOf(MessageDeliveryException.class);
        assertThatThrownBy(() -> send(demoOn, subscribe(DRIVER1, "/topic/drivers/garbage/offers")))
                .isInstanceOf(MessageDeliveryException.class);
    }

    @Test
    void subscribeRequiresUserAndTopicPrefix() {
        send(demoOn, subscribe(RIDER1, Topics.rideStatus(RIDE)));
        assertThatThrownBy(() -> send(demoOn, subscribe(null, Topics.rideStatus(RIDE))))
                .isInstanceOf(MessageDeliveryException.class);
        assertThatThrownBy(() -> send(demoOn, subscribe(RIDER1, "/queue/anything")))
                .isInstanceOf(MessageDeliveryException.class);
    }

    @Test
    void rideTopicsAreForTheRiderAndAssignedDriverOnly() {
        for (String topic : new String[]{Topics.rideStatus(RIDE), Topics.rideLocation(RIDE), Topics.rideChat(RIDE)}) {
            send(demoOn, subscribe(RIDER1, topic));
            send(demoOn, subscribe(DRIVER1, topic));
            assertThatThrownBy(() -> send(demoOn, subscribe(DRIVER2, topic)))
                    .as(topic).isInstanceOf(MessageDeliveryException.class);
        }
        // a ride nobody takes part in, a malformed id, and the bare prefix
        assertThatThrownBy(() -> send(demoOn, subscribe(RIDER1, Topics.rideStatus(UUID.randomUUID()))))
                .isInstanceOf(MessageDeliveryException.class);
        assertThatThrownBy(() -> send(demoOn, subscribe(RIDER1, "/topic/rides/garbage/status")))
                .isInstanceOf(MessageDeliveryException.class);
        assertThatThrownBy(() -> send(demoOn, subscribe(RIDER1, "/topic/rides/")))
                .isInstanceOf(MessageDeliveryException.class);
    }

    @Test
    void clientsCannotSend() {
        StompHeaderAccessor sendFrame = StompHeaderAccessor.create(StompCommand.SEND);
        sendFrame.setDestination(Topics.rideStatus(UUID.randomUUID()));
        sendFrame.setUser(new StompAuthInterceptor.StompUser(RIDER1));
        assertThatThrownBy(() -> send(demoOn, sendFrame)).isInstanceOf(MessageDeliveryException.class);
    }

    private static UUID userAfterConnect(StompAuthInterceptor interceptor, String header, String value) {
        StompHeaderAccessor connect = StompHeaderAccessor.create(StompCommand.CONNECT);
        connect.addNativeHeader(header, value);
        send(interceptor, connect);
        return ((StompAuthInterceptor.StompUser) connect.getUser()).id();
    }

    private static StompHeaderAccessor subscribe(UUID user, String destination) {
        StompHeaderAccessor sub = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        sub.setDestination(destination);
        sub.setSubscriptionId("sub-0");
        if (user != null) {
            sub.setUser(new StompAuthInterceptor.StompUser(user));
        }
        return sub;
    }

    private static Message<?> send(StompAuthInterceptor interceptor, StompHeaderAccessor accessor) {
        accessor.setLeaveMutable(true);
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
        return interceptor.preSend(message, null);
    }
}
