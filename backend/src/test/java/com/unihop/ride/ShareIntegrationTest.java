package com.unihop.ride;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.lessThan;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@Transactional
class ShareIntegrationTest {

    static final UUID RIDER1 = UUID.fromString("00000000-0000-0000-0000-000000000101");
    static final UUID DRIVER1 = UUID.fromString("00000000-0000-0000-0000-000000000201");
    static final String YARD = "00000000-0000-0000-0000-000000000301";
    static final String BUSCH_SC = "00000000-0000-0000-0000-000000000302";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void publicViewOfAnAcceptedRideWithoutAuth() throws Exception {
        String token = insertRide("ACCEPTED", DRIVER1);

        mvc.perform(get("/api/share/" + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.pickupHub.code").value("YARD"))
                .andExpect(jsonPath("$.dropoffHub.code").value("BUSCH_SC"))
                .andExpect(jsonPath("$.driver.name").value("Alex Kim"))
                .andExpect(jsonPath("$.driver.plate").value("R23-HKP"))
                .andExpect(jsonPath("$.driver.lat").value(40.5004))
                .andExpect(jsonPath("$.riderFirstName").value("Jordan"))
                // driver1 is ~95 m from The Yard
                .andExpect(jsonPath("$.etaSeconds").value(allOf(greaterThan(5), lessThan(30))))
                .andExpect(jsonPath("$.updatedAt").isString())
                // nothing private leaks
                .andExpect(jsonPath("$.pin").doesNotExist())
                .andExpect(jsonPath("$.payment").doesNotExist())
                .andExpect(jsonPath("$.rider").doesNotExist());
    }

    @Test
    void requestedRideHasNoDriverAndNoEta() throws Exception {
        String token = insertRide("REQUESTED", null);
        mvc.perform(get("/api/share/" + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REQUESTED"))
                .andExpect(jsonPath("$.driver").value(nullValue()))
                .andExpect(jsonPath("$.etaSeconds").value(nullValue()));
    }

    @Test
    void finishedRideHidesTheDriversCurrentLocation() throws Exception {
        String token = insertRide("COMPLETED", DRIVER1);
        jdbc.update("UPDATE rides SET completed_at = now() + interval '1 minute' WHERE share_token = ?", token);
        mvc.perform(get("/api/share/" + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.driver.name").value("Alex Kim"))
                .andExpect(jsonPath("$.driver.lat").value(nullValue()))
                .andExpect(jsonPath("$.driver.lng").value(nullValue()))
                .andExpect(jsonPath("$.etaSeconds").value(nullValue()));
        // updatedAt is the latest status timestamp
        String updatedAt = com.jayway.jsonpath.JsonPath.read(
                mvc.perform(get("/api/share/" + token)).andReturn().getResponse().getContentAsString(), "$.updatedAt");
        java.time.Instant completed = jdbc.queryForObject("SELECT completed_at FROM rides WHERE share_token = ?",
                java.sql.Timestamp.class, token).toInstant();
        assertThat(java.time.Instant.parse(updatedAt)).isEqualTo(completed);
    }

    @Test
    void unknownTokenIs404() throws Exception {
        mvc.perform(get("/api/share/not-a-real-token"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("NOT_FOUND"));
    }

    @Test
    void firstNameHandlesOddNames() {
        assertThat(ShareService.firstName("Jordan Patel")).isEqualTo("Jordan");
        assertThat(ShareService.firstName("  Maya  ")).isEqualTo("Maya");
        assertThat(ShareService.firstName(null)).isEqualTo("Rider");
        assertThat(ShareService.firstName(" ")).isEqualTo("Rider");
    }

    private String insertRide(String status, UUID driver) {
        String token = "share-" + UUID.randomUUID();
        jdbc.update("""
                INSERT INTO rides (id, rider_id, driver_id, pickup_hub_id, dropoff_hub_id, status, fare_total, platform_fee,
                                   base_fare, driver_payout, platform_margin, pin, share_token)
                VALUES (?, ?, ?, ?::uuid, ?::uuid, ?, 6.50, 1.50, 5.00, 4.50, 2.00, '4821', ?)""",
                UUID.randomUUID(), RIDER1, driver, YARD, BUSCH_SC, status, token);
        return token;
    }
}
