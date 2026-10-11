package com.unihop.matching;

import com.jayway.jsonpath.JsonPath;
import com.unihop.ride.RideTestData;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Not @Transactional: matching runs after commit, and the scheduled sweep runs on its own every second, so "due" cases
 * wait for the offer instead of assuming who dispatched it. Cleans up after each test.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class ScheduledRideIntegrationTest {

    static final UUID RIDER1 = UUID.fromString("00000000-0000-0000-0000-000000000101");
    static final UUID DRIVER1 = UUID.fromString("00000000-0000-0000-0000-000000000201");
    static final String YARD = "00000000-0000-0000-0000-000000000301";
    static final String BUSCH_SC = "00000000-0000-0000-0000-000000000302";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    MatchingService matching;

    List<Map<String, Object>> seededDrivers;

    @BeforeEach
    void snapshotDrivers() {
        seededDrivers = jdbc.queryForList("SELECT user_id, is_online, current_lat, current_lng FROM driver_profiles");
    }

    @AfterEach
    void cleanUp() {
        RideTestData.deleteAllRides(jdbc);
        for (Map<String, Object> d : seededDrivers) {
            jdbc.update("UPDATE driver_profiles SET is_online = ?, current_lat = ?, current_lng = ? WHERE user_id = ?",
                    d.get("is_online"), d.get("current_lat"), d.get("current_lng"), d.get("user_id"));
        }
    }

    @Test
    void futureRideIsStoredAuthorizedAndNotMatchedYet() throws Exception {
        Instant later = Instant.now().plus(1, ChronoUnit.HOURS).truncatedTo(ChronoUnit.SECONDS);
        UUID ride = request(later);

        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM rides WHERE id = ?", ride);
        assertThat(((java.sql.Timestamp) row.get("scheduled_for")).toInstant()).isEqualTo(later);
        assertThat(row.get("status")).isEqualTo("REQUESTED");
        assertThat(jdbc.queryForObject("SELECT status FROM ride_payments WHERE ride_id = ?", String.class, ride))
                .isEqualTo("AUTHORIZED");

        matching.dispatchDueScheduledRides();
        Thread.sleep(1500); // let the background sweep run too
        assertThat(offerCount(ride)).isZero();
    }

    @Test
    void matchingStartsOnceTheScheduledTimeArrives() throws Exception {
        UUID ride = request(Instant.now().plus(1, ChronoUnit.HOURS));
        assertThat(offerCount(ride)).isZero();

        jdbc.update("UPDATE rides SET scheduled_for = now() - interval '1 second' WHERE id = ?", ride);
        matching.dispatchDueScheduledRides();

        awaitLiveOffer(ride);
        assertThat(jdbc.queryForObject("SELECT driver_id FROM ride_offers WHERE ride_id = ? AND status = 'OFFERED'",
                UUID.class, ride)).isEqualTo(DRIVER1);
        // once offered, the sweep leaves it to the normal expiry / re-dispatch flow
        matching.dispatchDueScheduledRides();
        assertThat(offerCount(ride)).isEqualTo(1);
    }

    @Test
    void pastOrMissingScheduledTimeMatchesImmediately() throws Exception {
        UUID past = request(Instant.now().minus(5, ChronoUnit.MINUTES));
        assertThat(offerCount(past)).isEqualTo(1);
        mvc.perform(post("/api/rides/" + past + "/cancel").header("X-Demo-User", RIDER1.toString())
                .contentType("application/json").content("{}")).andExpect(status().isOk());

        UUID now = request(null);
        assertThat(offerCount(now)).isEqualTo(1);
    }

    @Test
    void scheduledRideCanBeCancelledBeforeItsTimeAndIsNeverOffered() throws Exception {
        UUID ride = request(Instant.now().plus(1, ChronoUnit.HOURS));
        mvc.perform(post("/api/rides/" + ride + "/cancel").header("X-Demo-User", RIDER1.toString())
                        .contentType("application/json").content("{\"reason\":\"Plans changed\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.payment.status").value("VOIDED"));

        jdbc.update("UPDATE rides SET scheduled_for = now() - interval '1 second' WHERE id = ?", ride);
        matching.dispatchDueScheduledRides();
        assertThat(offerCount(ride)).isZero();
    }

    private UUID request(Instant scheduledFor) throws Exception {
        String when = scheduledFor == null ? "null" : "\"" + scheduledFor + "\"";
        String body = mvc.perform(post("/api/rides").header("X-Demo-User", RIDER1.toString())
                        .contentType("application/json")
                        .content("{\"pickupHubId\":\"" + YARD + "\",\"dropoffHubId\":\"" + BUSCH_SC
                                + "\",\"scheduledFor\":" + when + "}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("REQUESTED"))
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(JsonPath.read(body, "$.id"));
    }

    private int offerCount(UUID ride) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM ride_offers WHERE ride_id = ?", Integer.class, ride);
        return n == null ? 0 : n;
    }

    private void awaitLiveOffer(UUID ride) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 3000;
        while (System.currentTimeMillis() < deadline) {
            Integer n = jdbc.queryForObject("SELECT count(*) FROM ride_offers WHERE ride_id = ? AND status = 'OFFERED'",
                    Integer.class, ride);
            if (n != null && n == 1) {
                return;
            }
            Thread.sleep(20);
        }
        throw new AssertionError("scheduled ride " + ride + " was never offered");
    }
}
