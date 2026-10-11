package com.unihop.ride;

import com.unihop.payments.PaymentService;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Rides are inserted directly in the needed state, so no matching is involved. */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@Transactional
class RideProgressIntegrationTest {

    static final UUID RIDER1 = UUID.fromString("00000000-0000-0000-0000-000000000101");
    static final UUID DRIVER1 = UUID.fromString("00000000-0000-0000-0000-000000000201");
    static final UUID DRIVER2 = UUID.fromString("00000000-0000-0000-0000-000000000202");
    static final String YARD = "00000000-0000-0000-0000-000000000301";
    static final String BUSCH_SC = "00000000-0000-0000-0000-000000000302";
    static final String PIN = "4821";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    /** Pure mock: these tests cover the ride state machine; directly inserted rides have no payment rows. */
    @MockitoBean
    PaymentService paymentService;

    @Test
    void driverTakesTheRideFromAcceptedToCompleted() throws Exception {
        UUID ride = insertRide("ACCEPTED");

        as(DRIVER1, ride, "arrived", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ARRIVED"))
                .andExpect(jsonPath("$.arrivedAt").isString())
                .andExpect(jsonPath("$.startedAt").value(nullValue()))
                .andExpect(jsonPath("$.pin").value(nullValue()));

        as(DRIVER1, ride, "start", "{\"pin\":\"" + PIN + "\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.startedAt").isString());
        verify(paymentService, never()).captureRide(any());

        as(DRIVER1, ride, "complete", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.completedAt").isString());
        verify(paymentService).captureRide(ride);

        var row = jdbc.queryForMap("SELECT * FROM rides WHERE id = ?", ride);
        assertThat(row.get("status")).isEqualTo("COMPLETED");
        assertThat(row.get("arrived_at")).isNotNull();
        assertThat(row.get("started_at")).isNotNull();
        assertThat(row.get("completed_at")).isNotNull();
    }

    @Test
    void wrongOrMissingPinIs400AndRideStaysArrived() throws Exception {
        UUID ride = insertRide("ARRIVED");
        as(DRIVER1, ride, "start", "{\"pin\":\"0000\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_PIN"));
        as(DRIVER1, ride, "start", "{}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        assertThat(statusOf(ride)).isEqualTo("ARRIVED");
        // surrounding whitespace is forgiven
        as(DRIVER1, ride, "start", "{\"pin\":\" " + PIN + " \"}").andExpect(status().isOk());
    }

    @Test
    void onlyTheAssignedDriverCanProgress() throws Exception {
        UUID ride = insertRide("ACCEPTED");
        for (UUID other : new UUID[]{DRIVER2, RIDER1}) {
            as(other, ride, "arrived", null)
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error").value("FORBIDDEN"));
        }
        jdbc.update("UPDATE rides SET status = 'ARRIVED' WHERE id = ?", ride);
        as(DRIVER2, ride, "start", "{\"pin\":\"" + PIN + "\"}").andExpect(status().isForbidden());
        jdbc.update("UPDATE rides SET status = 'IN_PROGRESS' WHERE id = ?", ride);
        as(RIDER1, ride, "complete", null).andExpect(status().isForbidden());
        verify(paymentService, never()).captureRide(any());
        as(DRIVER1, UUID.randomUUID(), "arrived", null)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("NOT_FOUND"));
    }

    @Test
    void outOfOrderStepsAre409() throws Exception {
        UUID ride = insertRide("ACCEPTED");
        as(DRIVER1, ride, "start", "{\"pin\":\"" + PIN + "\"}")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("INVALID_TRANSITION"));
        as(DRIVER1, ride, "complete", null)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("INVALID_TRANSITION"));

        jdbc.update("UPDATE rides SET status = 'ARRIVED' WHERE id = ?", ride);
        as(DRIVER1, ride, "arrived", null).andExpect(status().isConflict());
        as(DRIVER1, ride, "complete", null).andExpect(status().isConflict());

        jdbc.update("UPDATE rides SET status = 'COMPLETED' WHERE id = ?", ride);
        as(DRIVER1, ride, "complete", null).andExpect(status().isConflict());
        jdbc.update("UPDATE rides SET status = 'CANCELLED' WHERE id = ?", ride);
        as(DRIVER1, ride, "arrived", null).andExpect(status().isConflict());
        verify(paymentService, never()).captureRide(any());
    }

    /** Runs outside the test transaction so the real rollback is visible. */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void captureFailureLeavesRideInProgress() throws Exception {
        UUID ride = insertRide("IN_PROGRESS");
        try {
            doThrow(new IllegalStateException("gateway down")).when(paymentService).captureRide(ride);
            as(DRIVER1, ride, "complete", null)
                    .andExpect(status().isInternalServerError())
                    .andExpect(jsonPath("$.error").value("INTERNAL_ERROR"));
            var row = jdbc.queryForMap("SELECT * FROM rides WHERE id = ?", ride);
            assertThat(row.get("status")).isEqualTo("IN_PROGRESS");
            assertThat(row.get("completed_at")).isNull();
        } finally {
            jdbc.update("DELETE FROM rides WHERE id = ?", ride);
        }
    }

    private UUID insertRide(String status) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO rides (id, rider_id, driver_id, pickup_hub_id, dropoff_hub_id, status, fare_total, platform_fee,
                                   base_fare, driver_payout, platform_margin, pin, share_token, accepted_at)
                VALUES (?, ?, ?, ?::uuid, ?::uuid, ?, 6.50, 1.50, 5.00, 4.50, 2.00, ?, ?, now())""",
                id, RIDER1, DRIVER1, YARD, BUSCH_SC, status, PIN, "share-" + id);
        return id;
    }

    private String statusOf(UUID ride) {
        return jdbc.queryForObject("SELECT status FROM rides WHERE id = ?", String.class, ride);
    }

    private ResultActions as(UUID user, UUID ride, String action, String body) throws Exception {
        var request = post("/api/rides/" + ride + "/" + action).header("X-Demo-User", user.toString());
        if (body != null) {
            request = request.contentType("application/json").content(body);
        }
        return mvc.perform(request);
    }
}
