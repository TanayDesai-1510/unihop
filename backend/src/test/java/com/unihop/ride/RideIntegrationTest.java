package com.unihop.ride;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Runs against the scaffold StubPaymentService (always authorizes). */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@Transactional
class RideIntegrationTest {

    static final String RIDER1 = "00000000-0000-0000-0000-000000000101";
    static final String RIDER2 = "00000000-0000-0000-0000-000000000102";
    static final String DRIVER1 = "00000000-0000-0000-0000-000000000201";
    static final String YARD = "00000000-0000-0000-0000-000000000301";
    static final String BUSCH_SC = "00000000-0000-0000-0000-000000000302";
    static final String COOK_CC = "00000000-0000-0000-0000-000000000304";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void createReturns201WithContractShape() throws Exception {
        request(RIDER1, YARD, BUSCH_SC)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.status").value("REQUESTED"))
                .andExpect(jsonPath("$.rider.id").value(RIDER1))
                .andExpect(jsonPath("$.rider.name").value("Jordan Patel"))
                .andExpect(jsonPath("$.rider.ratingAvg").value(4.95))
                .andExpect(jsonPath("$.pickupHub.code").value("YARD"))
                .andExpect(jsonPath("$.dropoffHub.zone").value("BUSCH"))
                .andExpect(jsonPath("$.fare.total").value(6.5))
                .andExpect(jsonPath("$.fare.driverPayout").value(4.5))
                .andExpect(jsonPath("$.payment.status").value("AUTHORIZED"))
                .andExpect(jsonPath("$.payment.amountTotal").value(6.5))
                .andExpect(jsonPath("$.shareToken").isString())
                .andExpect(jsonPath("$.requestedAt").isString())
                // nullable fields are present as null
                .andExpect(jsonPath("$.driver").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.pin").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.acceptedAt").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.cancelledBy").value(org.hamcrest.Matchers.nullValue()));

        var row = jdbc.queryForMap("SELECT * FROM rides WHERE rider_id = ?::uuid", RIDER1);
        assertThat(row.get("status")).isEqualTo("REQUESTED");
        assertThat(row.get("fare_total").toString()).isEqualTo("6.50");
        assertThat(row.get("platform_margin").toString()).isEqualTo("2.00");
        assertThat((String) row.get("share_token")).hasSizeGreaterThanOrEqualTo(20);
    }

    @Test
    void secondRequestWhileActiveIs409() throws Exception {
        request(RIDER1, YARD, BUSCH_SC).andExpect(status().isCreated());
        request(RIDER1, BUSCH_SC, COOK_CC)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("ACTIVE_RIDE_EXISTS"));
        assertThat(rideCount(RIDER1)).isEqualTo(1);

        // a terminal ride does not block a new one
        jdbc.update("UPDATE rides SET status = 'CANCELLED' WHERE rider_id = ?::uuid", RIDER1);
        request(RIDER1, BUSCH_SC, COOK_CC).andExpect(status().isCreated());
    }

    @Test
    void badHubsAndBodies() throws Exception {
        request(RIDER1, YARD, YARD).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("SAME_HUB"));
        request(RIDER1, YARD, UUID.randomUUID().toString())
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("HUB_NOT_FOUND"));
        mvc.perform(post("/api/rides").header("X-Demo-User", RIDER1).contentType("application/json")
                        .content("{\"dropoffHubId\":\"" + YARD + "\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        assertThat(rideCount(RIDER1)).isZero();
        mvc.perform(post("/api/rides").contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getIsForParticipantsOnly() throws Exception {
        String id = createdId(RIDER1, YARD, BUSCH_SC);
        mvc.perform(get("/api/rides/" + id).header("X-Demo-User", RIDER1))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        mvc.perform(get("/api/rides/" + id).header("X-Demo-User", RIDER2))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("FORBIDDEN"));
        mvc.perform(get("/api/rides/" + id).header("X-Demo-User", DRIVER1))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/rides/" + UUID.randomUUID()).header("X-Demo-User", RIDER1))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("NOT_FOUND"));
    }

    @Test
    void assignedDriverSeesRideWithoutPinAndRiderSeesPin() throws Exception {
        String id = createdId(RIDER1, YARD, BUSCH_SC);
        jdbc.update("UPDATE rides SET status = 'ACCEPTED', driver_id = ?::uuid, pin = '4821', accepted_at = now() WHERE id = ?::uuid",
                DRIVER1, id);

        mvc.perform(get("/api/rides/" + id).header("X-Demo-User", RIDER1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pin").value("4821"))
                .andExpect(jsonPath("$.driver.id").value(DRIVER1))
                .andExpect(jsonPath("$.driver.name").value("Alex Kim"))
                .andExpect(jsonPath("$.driver.plate").value("R23-HKP"))
                .andExpect(jsonPath("$.driver.lat").value(40.5004))
                .andExpect(jsonPath("$.acceptedAt").isString());
        mvc.perform(get("/api/rides/" + id).header("X-Demo-User", DRIVER1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pin").value(org.hamcrest.Matchers.nullValue()));
        mvc.perform(get("/api/rides/active").header("X-Demo-User", DRIVER1))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.pin").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void activeReturnsRideOr204() throws Exception {
        mvc.perform(get("/api/rides/active").header("X-Demo-User", RIDER1))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        String id = createdId(RIDER1, YARD, BUSCH_SC);
        mvc.perform(get("/api/rides/active").header("X-Demo-User", RIDER1))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        mvc.perform(get("/api/rides/active").header("X-Demo-User", RIDER2)).andExpect(status().isNoContent());

        jdbc.update("UPDATE rides SET status = 'COMPLETED' WHERE id = ?::uuid", id);
        mvc.perform(get("/api/rides/active").header("X-Demo-User", RIDER1)).andExpect(status().isNoContent());
    }

    @Test
    void paymentSummaryIsReadFromRidePayments() throws Exception {
        // rider1 has 5.00 UniHop Cash and a default Visa 4242; Yard -> Busch is 6.50
        String body = mvc.perform(post("/api/rides").header("X-Demo-User", RIDER1).contentType("application/json")
                        .content("{\"pickupHubId\":\"" + YARD + "\",\"dropoffHubId\":\"" + BUSCH_SC + "\",\"useCredits\":true}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String id = com.jayway.jsonpath.JsonPath.read(body, "$.id");
        // The real PaymentService writes this row itself during authorizeRide; StubPaymentService writes nothing, so
        // insert the same split only if no row exists. Either way the reader is checked against a credits + card split.
        jdbc.update("""
                INSERT INTO ride_payments (id, ride_id, user_id, payment_method_id, amount_total, credits_applied,
                                           card_amount, status, authorized_at)
                VALUES (?, ?::uuid, ?::uuid, '00000000-0000-0000-0000-000000000401', 6.50, 5.00, 1.50, 'AUTHORIZED', now())
                ON CONFLICT (ride_id) DO NOTHING""",
                UUID.randomUUID(), id, RIDER1);
        mvc.perform(get("/api/rides/" + id).header("X-Demo-User", RIDER1))
                .andExpect(jsonPath("$.payment.methodLabel").value("UniHop Cash + Visa •••• 4242"))
                .andExpect(jsonPath("$.payment.creditsApplied").value(5.0))
                .andExpect(jsonPath("$.payment.cardAmount").value(1.5))
                .andExpect(jsonPath("$.payment.declineCode").value(org.hamcrest.Matchers.nullValue()));
    }

    private ResultActions request(String rider, String from, String to) throws Exception {
        return mvc.perform(post("/api/rides").header("X-Demo-User", rider).contentType("application/json")
                .content("{\"pickupHubId\":\"" + from + "\",\"dropoffHubId\":\"" + to + "\"}"));
    }

    private String createdId(String rider, String from, String to) throws Exception {
        String body = request(rider, from, to).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(body, "$.id");
    }

    private int rideCount(String rider) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM rides WHERE rider_id = ?::uuid", Integer.class, rider);
        return n == null ? 0 : n;
    }
}
