package com.unihop.ride;

import com.jayway.jsonpath.JsonPath;
import com.unihop.realtime.RealtimePublisher;
import com.unihop.ride.dto.ChatMessage;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.UUID;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Not @Transactional: the chat push happens after commit. Rides are inserted directly; cleaned up after each test. */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class ChatIntegrationTest {

    static final UUID RIDER1 = UUID.fromString("00000000-0000-0000-0000-000000000101");
    static final UUID RIDER2 = UUID.fromString("00000000-0000-0000-0000-000000000102");
    static final UUID DRIVER1 = UUID.fromString("00000000-0000-0000-0000-000000000201");
    static final UUID DRIVER2 = UUID.fromString("00000000-0000-0000-0000-000000000202");
    static final String YARD = "00000000-0000-0000-0000-000000000301";
    static final String BUSCH_SC = "00000000-0000-0000-0000-000000000302";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @MockitoSpyBean
    RealtimePublisher publisher;

    @AfterEach
    void cleanUp() {
        RideTestData.deleteAllRides(jdbc);
    }

    @Test
    void riderAndDriverChatAndEachMessageIsPushed() throws Exception {
        UUID ride = insertRide();

        String sent = send(RIDER1, ride, "  I'm by the bus stop  ")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.senderId").value(RIDER1.toString()))
                .andExpect(jsonPath("$.body").value("I'm by the bus stop"))
                .andExpect(jsonPath("$.createdAt").isString())
                .andReturn().getResponse().getContentAsString();
        send(DRIVER1, ride, "Blue Civic, 1 min").andExpect(status().isOk());

        ArgumentCaptor<ChatMessage> pushed = ArgumentCaptor.forClass(ChatMessage.class);
        verify(publisher, org.mockito.Mockito.times(2)).chat(eq(ride), pushed.capture());
        assertThat(pushed.getAllValues().get(0).id().toString()).isEqualTo(JsonPath.read(sent, "$.id"));
        assertThat(pushed.getAllValues()).extracting(ChatMessage::senderId).containsExactly(RIDER1, DRIVER1);

        for (UUID reader : new UUID[]{RIDER1, DRIVER1}) {
            mvc.perform(get("/api/rides/" + ride + "/chat").header("X-Demo-User", reader.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(2)))
                    .andExpect(jsonPath("$[0].body").value("I'm by the bus stop"))
                    .andExpect(jsonPath("$[1].senderId").value(DRIVER1.toString()));
        }
    }

    @Test
    void outsidersAre403AndUnknownRideIs404() throws Exception {
        UUID ride = insertRide();
        for (UUID outsider : new UUID[]{RIDER2, DRIVER2}) {
            send(outsider, ride, "hi").andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("FORBIDDEN"));
            mvc.perform(get("/api/rides/" + ride + "/chat").header("X-Demo-User", outsider.toString()))
                    .andExpect(status().isForbidden());
        }
        send(RIDER1, UUID.randomUUID(), "hi").andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("NOT_FOUND"));
        mvc.perform(get("/api/rides/" + ride + "/chat")).andExpect(status().isUnauthorized());
        verify(publisher, never()).chat(any(), any());
    }

    @Test
    void blankOrTooLongBodiesAreRejected() throws Exception {
        UUID ride = insertRide();
        send(RIDER1, ride, "   ").andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        send(RIDER1, ride, "x".repeat(1001)).andExpect(status().isBadRequest());
        mvc.perform(post("/api/rides/" + ride + "/chat").header("X-Demo-User", RIDER1.toString())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());
        send(RIDER1, ride, "x".repeat(1000)).andExpect(status().isOk());
        mvc.perform(get("/api/rides/" + ride + "/chat").header("X-Demo-User", RIDER1.toString()))
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void emptyChatIsAnEmptyList() throws Exception {
        UUID ride = insertRide();
        mvc.perform(get("/api/rides/" + ride + "/chat").header("X-Demo-User", DRIVER1.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    private ResultActions send(UUID user, UUID ride, String body) throws Exception {
        return mvc.perform(post("/api/rides/" + ride + "/chat").header("X-Demo-User", user.toString())
                .contentType("application/json")
                .content("{\"body\":\"" + body + "\"}"));
    }

    private UUID insertRide() {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO rides (id, rider_id, driver_id, pickup_hub_id, dropoff_hub_id, status, fare_total, platform_fee,
                                   base_fare, driver_payout, platform_margin, pin, share_token, accepted_at)
                VALUES (?, ?, ?, ?::uuid, ?::uuid, 'ACCEPTED', 6.50, 1.50, 5.00, 4.50, 2.00, '4821', ?, now())""",
                id, RIDER1, DRIVER1, YARD, BUSCH_SC, "share-" + id);
        return id;
    }
}
