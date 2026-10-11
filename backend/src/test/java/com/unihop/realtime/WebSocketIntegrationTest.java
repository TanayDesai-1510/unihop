package com.unihop.realtime;

import com.fasterxml.jackson.databind.JsonNode;
import com.unihop.common.enums.RideStatus;
import com.unihop.common.enums.Zone;
import com.unihop.matching.RideOffer;
import com.unihop.pricing.FareBreakdown;
import com.unihop.ride.dto.DriverCard;
import com.unihop.ride.dto.Hub;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import java.lang.reflect.Type;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** A real STOMP client connects to /ws on a random port, subscribes, and receives contract-shaped payloads. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class WebSocketIntegrationTest {

    static final UUID RIDER1 = UUID.fromString("00000000-0000-0000-0000-000000000101");
    static final UUID DRIVER1 = UUID.fromString("00000000-0000-0000-0000-000000000201");
    static final Hub YARD = new Hub(UUID.fromString("00000000-0000-0000-0000-000000000301"),
            "YARD", "The Yard", Zone.COLLEGE_AVE, 40.4998, -74.4479);
    static final Hub BUSCH_SC = new Hub(UUID.fromString("00000000-0000-0000-0000-000000000302"),
            "BUSCH_SC", "Busch Student Center", Zone.BUSCH, 40.5232, -74.4585);

    @LocalServerPort
    int port;

    @Autowired
    RealtimePublisher publisher;

    final WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
    StompSession session;

    @AfterEach
    void close() {
        if (session != null && session.isConnected()) {
            session.disconnect();
        }
        client.stop();
    }

    @Test
    void riderReceivesStatusAndLocationWithContractShape() throws Exception {
        session = connect("X-Demo-User", RIDER1.toString());
        UUID rideId = UUID.randomUUID();
        BlockingQueue<JsonNode> status = subscribe(Topics.rideStatus(rideId));
        BlockingQueue<JsonNode> location = subscribe(Topics.rideLocation(rideId));

        DriverCard driver = new DriverCard(DRIVER1, "Alex Kim", new BigDecimal("4.90"),
                "Honda", "Civic", "Blue", "R23-HKP", 40.5004, -74.4471);
        publishUntilReceived(status, () -> publisher.rideStatus(new RideStatusEvent(
                rideId, RideStatus.ACCEPTED, driver, 120, Instant.parse("2026-10-11T14:30:00Z"))));
        JsonNode s = status.poll(5, TimeUnit.SECONDS);
        assertThat(s.get("rideId").asText()).isEqualTo(rideId.toString());
        assertThat(s.get("status").asText()).isEqualTo("ACCEPTED");
        assertThat(s.get("driver").get("plate").asText()).isEqualTo("R23-HKP");
        assertThat(s.get("driver").get("ratingAvg").decimalValue()).isEqualByComparingTo("4.90");
        assertThat(s.get("etaSeconds").asInt()).isEqualTo(120);
        assertThat(s.get("updatedAt").asText()).isEqualTo("2026-10-11T14:30:00Z");

        publisher.rideStatus(new RideStatusEvent(rideId, RideStatus.CANCELLED, null, null, Instant.now()));
        JsonNode cancelled = status.poll(5, TimeUnit.SECONDS);
        // nullable fields are present as null, never omitted
        assertThat(cancelled.has("driver")).isTrue();
        assertThat(cancelled.get("driver").isNull()).isTrue();
        assertThat(cancelled.get("etaSeconds").isNull()).isTrue();

        publisher.rideLocation(rideId, new RideLocationEvent(40.5, -74.45, 270.0, 90));
        JsonNode l = location.poll(5, TimeUnit.SECONDS);
        assertThat(fieldNames(l)).containsExactlyInAnyOrder("lat", "lng", "heading", "etaSeconds");
        assertThat(l.get("heading").asDouble()).isEqualTo(270.0);
    }

    @Test
    void driverReceivesOfferAndRevocation() throws Exception {
        session = connect("X-Demo-User", DRIVER1.toString());
        BlockingQueue<JsonNode> offers = subscribe(Topics.driverOffers(DRIVER1));

        UUID offerId = UUID.randomUUID();
        RideOffer offer = new RideOffer(offerId, UUID.randomUUID(), YARD, BUSCH_SC,
                FareBreakdown.fromTotal(new BigDecimal("6.50")), "Jordan Patel", new BigDecimal("5.00"),
                85, Instant.parse("2026-10-11T14:30:15Z"));
        publishUntilReceived(offers, () -> publisher.offer(DRIVER1, offer));
        JsonNode o = offers.poll(5, TimeUnit.SECONDS);
        assertThat(fieldNames(o)).containsExactlyInAnyOrder("offerId", "rideId", "pickupHub", "dropoffHub", "fare",
                "riderName", "riderRating", "distanceToPickupMeters", "expiresAt");
        assertThat(o.get("pickupHub").get("zone").asText()).isEqualTo("COLLEGE_AVE");
        assertThat(o.get("fare").get("driverPayout").decimalValue()).isEqualByComparingTo("4.50");
        assertThat(o.get("expiresAt").asText()).isEqualTo("2026-10-11T14:30:15Z");

        publisher.offerRevoked(DRIVER1, offerId);
        JsonNode r = offers.poll(5, TimeUnit.SECONDS);
        assertThat(r.get("type").asText()).isEqualTo("OFFER_REVOKED");
        assertThat(r.get("offerId").asText()).isEqualTo(offerId.toString());
    }

    @Test
    void connectWithoutCredentialsFails() {
        assertThatThrownBy(() -> connect(null, null)).isInstanceOf(ExecutionException.class);
    }

    private StompSession connect(String header, String value) throws Exception {
        StompHeaders connectHeaders = new StompHeaders();
        if (header != null) {
            connectHeaders.add(header, value);
        }
        client.setMessageConverter(new MappingJackson2MessageConverter());
        return client.connectAsync("ws://localhost:" + port + "/ws", new WebSocketHttpHeaders(), connectHeaders,
                new StompSessionHandlerAdapter() {
                    @Override
                    public void handleException(StompSession s, StompCommand command, StompHeaders headers,
                                                byte[] payload, Throwable exception) {
                        throw new AssertionError("STOMP frame handling failed", exception);
                    }
                }).get(5, TimeUnit.SECONDS);
    }

    private BlockingQueue<JsonNode> subscribe(String destination) {
        BlockingQueue<JsonNode> received = new LinkedBlockingQueue<>();
        session.subscribe(destination, new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return JsonNode.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                received.add((JsonNode) payload);
            }
        });
        return received;
    }

    /**
     * SUBSCRIBE is asynchronous, so the first publish can race it. Re-publish until one arrives, then leave
     * that message at the head of the queue (later duplicates are drained).
     */
    private static void publishUntilReceived(BlockingQueue<JsonNode> queue, Runnable publish) throws InterruptedException {
        for (int i = 0; i < 50 && queue.isEmpty(); i++) {
            publish.run();
            Thread.sleep(100);
        }
        assertThat(queue).as("no message received").isNotEmpty();
        JsonNode first = queue.take();
        Thread.sleep(150);
        queue.clear();
        queue.add(first);
    }

    private static java.util.List<String> fieldNames(JsonNode node) {
        java.util.List<String> names = new java.util.ArrayList<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }
}
