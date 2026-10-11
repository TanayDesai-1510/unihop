package com.unihop.ride;

import com.jayway.jsonpath.JsonPath;
import com.unihop.payments.PaymentService;
import com.unihop.realtime.RealtimePublisher;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
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

/**
 * Most cases insert the ride directly in the needed state. Cases that need a real offer or a real rollback run
 * outside the test transaction and clean up after themselves. NO_DRIVERS -> voidRide is covered in
 * {@code MatchingIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@Transactional
class RideCancelIntegrationTest {

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

    /** Pure mock: these tests cover the ride state machine; directly inserted rides have no payment rows. */
    @MockitoBean
    PaymentService paymentService;

    @MockitoSpyBean
    RealtimePublisher publisher;

    @Test
    void riderCancelsAcceptedRide() throws Exception {
        UUID ride = insertRide("ACCEPTED");
        cancel(RIDER1, ride, "Plans changed")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancelledBy").value("RIDER"))
                .andExpect(jsonPath("$.cancelReason").value("Plans changed"))
                .andExpect(jsonPath("$.cancelledAt").isString());
        verify(paymentService).voidRide(ride);
    }

    @Test
    void assignedDriverCancelsArrivedRideAndSeesNoPin() throws Exception {
        UUID ride = insertRide("ARRIVED");
        cancel(DRIVER1, ride, "Rider not at pickup")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancelledBy").value("DRIVER"))
                .andExpect(jsonPath("$.pin").value(nullValue()));
        verify(paymentService).voidRide(ride);
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM rides WHERE id = ?", ride);
        assertThat(row.get("cancelled_by")).isEqualTo("DRIVER");
        assertThat(row.get("cancelled_at")).isNotNull();
    }

    @Test
    void inProgressAndTerminalRidesCannotBeCancelled() throws Exception {
        for (String status : new String[]{"IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_DRIVERS"}) {
            UUID ride = insertRide(status);
            cancel(RIDER1, ride, "too late")
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.error").value("INVALID_TRANSITION"));
            assertThat(jdbc.queryForObject("SELECT status FROM rides WHERE id = ?", String.class, ride)).isEqualTo(status);
            jdbc.update("UPDATE rides SET status = 'COMPLETED' WHERE id = ?", ride);
        }
        verify(paymentService, never()).voidRide(any());
    }

    @Test
    void outsidersAre403AndUnknownRideIs404() throws Exception {
        UUID ride = insertRide("ACCEPTED");
        cancel(RIDER2, ride, "x").andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("FORBIDDEN"));
        cancel(DRIVER2, ride, "x").andExpect(status().isForbidden());
        cancel(RIDER1, UUID.randomUUID(), "x").andExpect(status().isNotFound());
        verify(paymentService, never()).voidRide(any());
    }

    @Test
    void reasonIsOptionalButBounded() throws Exception {
        UUID ride = insertRide("ACCEPTED");
        cancel(RIDER1, ride, "x".repeat(256))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        mvc.perform(post("/api/rides/" + ride + "/cancel").header("X-Demo-User", RIDER1.toString())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cancelReason").value(nullValue()));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void riderCancelWhileOfferIsLiveRevokesItVoidsAndFreesTheRider() throws Exception {
        try {
            UUID ride = requestRide();
            UUID offerId = jdbc.queryForObject(
                    "SELECT id FROM ride_offers WHERE ride_id = ? AND status = 'OFFERED'", UUID.class, ride);

            cancel(RIDER1, ride, "Found a friend")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("CANCELLED"))
                    .andExpect(jsonPath("$.cancelledBy").value("RIDER"));

            assertThat(jdbc.queryForObject("SELECT status FROM ride_offers WHERE id = ?", String.class, offerId))
                    .isEqualTo("EXPIRED");
            verify(publisher).offerRevoked(DRIVER1, offerId);
            verify(paymentService).voidRide(ride);
            // the driver can no longer accept, and the rider may request again
            mvc.perform(post("/api/rides/" + ride + "/accept").header("X-Demo-User", DRIVER1.toString()))
                    .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("OFFER_NOT_ACTIVE"));
            requestRide();
        } finally {
            cleanUp();
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void voidFailureRollsTheCancelBackAndRevokesNothing() throws Exception {
        try {
            UUID ride = requestRide();
            doThrow(new IllegalStateException("gateway down")).when(paymentService).voidRide(ride);

            cancel(RIDER1, ride, "x").andExpect(status().isInternalServerError());

            assertThat(jdbc.queryForObject("SELECT status FROM rides WHERE id = ?", String.class, ride))
                    .isEqualTo("REQUESTED");
            assertThat(jdbc.queryForObject("SELECT status FROM ride_offers WHERE ride_id = ?", String.class, ride))
                    .isEqualTo("OFFERED");
            verify(publisher, never()).offerRevoked(any(), any());
        } finally {
            cleanUp();
        }
    }

    private void cleanUp() {
        RideTestData.deleteAllRides(jdbc);
    }

    private UUID requestRide() throws Exception {
        String body = mvc.perform(post("/api/rides").header("X-Demo-User", RIDER1.toString())
                        .contentType("application/json")
                        .content("{\"pickupHubId\":\"" + YARD + "\",\"dropoffHubId\":\"" + BUSCH_SC + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(JsonPath.read(body, "$.id"));
    }

    private UUID insertRide(String status) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO rides (id, rider_id, driver_id, pickup_hub_id, dropoff_hub_id, status, fare_total, platform_fee,
                                   base_fare, driver_payout, platform_margin, pin, share_token, accepted_at)
                VALUES (?, ?, ?, ?::uuid, ?::uuid, ?, 6.50, 1.50, 5.00, 4.50, 2.00, '4821', ?, now())""",
                id, RIDER1, DRIVER1, YARD, BUSCH_SC, status, "share-" + id);
        return id;
    }

    private ResultActions cancel(UUID user, UUID ride, String reason) throws Exception {
        return mvc.perform(post("/api/rides/" + ride + "/cancel").header("X-Demo-User", user.toString())
                .contentType("application/json").content("{\"reason\":\"" + reason + "\"}"));
    }
}
