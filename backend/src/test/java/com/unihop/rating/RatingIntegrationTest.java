package com.unihop.rating;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@Transactional
class RatingIntegrationTest {
    private static final UUID RIDER1 = UUID.fromString("00000000-0000-0000-0000-000000000101");
    private static final UUID RIDER2 = UUID.fromString("00000000-0000-0000-0000-000000000102");
    private static final UUID DRIVER1 = UUID.fromString("00000000-0000-0000-0000-000000000201");
    private static final UUID DRIVER2 = UUID.fromString("00000000-0000-0000-0000-000000000202");

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @Test
    void bothParticipantsCanRateAndRateeAverageIsUpdated() throws Exception {
        UUID ride = insertRide(RIDER2, DRIVER1, "COMPLETED");

        rate(DRIVER1, ride, "{\"stars\":3,\"comment\":\"  Friendly rider  \"}")
                .andExpect(status().isNoContent());
        rate(RIDER2, ride, "{\"stars\":5}")
                .andExpect(status().isNoContent());

        Map<String, Object> driverRating = jdbc.queryForMap(
                "SELECT rating_avg, rating_count FROM users WHERE id = ?", DRIVER1);
        assertThat(driverRating.get("rating_avg")).isEqualTo(new BigDecimal("4.92"));
        assertThat(driverRating.get("rating_count")).isEqualTo(135);

        Map<String, Object> riderRating = jdbc.queryForMap(
                "SELECT rating_avg, rating_count FROM users WHERE id = ?", RIDER2);
        assertThat(riderRating.get("rating_avg")).isEqualTo(new BigDecimal("4.62"));
        assertThat(riderRating.get("rating_count")).isEqualTo(10);

        Map<String, Object> stored = jdbc.queryForMap(
                "SELECT ratee_id, stars, comment FROM ratings WHERE ride_id = ? AND rater_id = ?", ride, DRIVER1);
        assertThat(stored.get("ratee_id")).isEqualTo(RIDER2);
        assertThat(stored.get("stars")).isEqualTo(3);
        assertThat(stored.get("comment")).isEqualTo("Friendly rider");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM ratings WHERE ride_id = ?", Integer.class, ride))
                .isEqualTo(2);
    }

    @Test
    void duplicateRatingReturnsAlreadyRatedWithoutUpdatingTwice() throws Exception {
        UUID ride = insertRide(RIDER1, DRIVER2, "COMPLETED");
        rate(RIDER1, ride, "{\"stars\":4}").andExpect(status().isNoContent());

        rate(RIDER1, ride, "{\"stars\":1}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("ALREADY_RATED"));

        assertThat(jdbc.queryForObject("SELECT count(*) FROM ratings WHERE ride_id = ?", Integer.class, ride))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT rating_count FROM users WHERE id = ?", Integer.class, DRIVER2))
                .isEqualTo(213);
    }

    @Test
    void onlyParticipantsInCompletedRidesCanRate() throws Exception {
        UUID completed = insertRide(RIDER1, DRIVER1, "COMPLETED");
        UUID active = insertRide(RIDER1, DRIVER1, "IN_PROGRESS");

        rate(RIDER2, completed, "{\"stars\":5}")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("FORBIDDEN"));
        rate(RIDER1, active, "{\"stars\":5}")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("FORBIDDEN"));
        rate(RIDER1, UUID.randomUUID(), "{\"stars\":5}")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("NOT_FOUND"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM ratings", Integer.class)).isZero();
    }

    @Test
    void starsAndCommentAreValidated() throws Exception {
        UUID ride = insertRide(RIDER1, DRIVER1, "COMPLETED");

        rate(RIDER1, ride, "{\"stars\":0}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        rate(RIDER1, ride, "{\"stars\":6}")
                .andExpect(status().isBadRequest());
        rate(RIDER1, ride, "{\"stars\":5,\"comment\":\"" + "x".repeat(501) + "\"}")
                .andExpect(status().isBadRequest());
        rate(RIDER1, ride, "{}")
                .andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM ratings", Integer.class)).isZero();
    }

    private UUID insertRide(UUID riderId, UUID driverId, String status) {
        UUID ride = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO rides
                    (id, rider_id, driver_id, pickup_hub_id, dropoff_hub_id, status, fare_total,
                     platform_fee, base_fare, driver_payout, platform_margin, share_token,
                     requested_at, started_at, completed_at)
                VALUES (?, ?, ?,
                        '00000000-0000-0000-0000-000000000301',
                        '00000000-0000-0000-0000-000000000302', ?,
                        6.50, 1.50, 5.00, 4.50, 2.00, ?, now() - interval '1 hour',
                        CASE WHEN ? = 'COMPLETED' THEN now() - interval '30 minutes' ELSE now() END,
                        CASE WHEN ? = 'COMPLETED' THEN now() ELSE NULL END)
                """, ride, riderId, driverId, status, "share-" + ride, status, status);
        return ride;
    }

    private org.springframework.test.web.servlet.ResultActions rate(UUID userId, UUID rideId, String body)
            throws Exception {
        return mvc.perform(post("/api/rides/" + rideId + "/rating")
                .header("X-Demo-User", userId.toString())
                .contentType("application/json")
                .content(body));
    }
}
