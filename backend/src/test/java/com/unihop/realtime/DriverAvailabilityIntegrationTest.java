package com.unihop.realtime;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.util.Map;
import java.util.UUID;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@Transactional
class DriverAvailabilityIntegrationTest {

    static final UUID RIDER1 = UUID.fromString("00000000-0000-0000-0000-000000000101");
    static final UUID DRIVER1 = UUID.fromString("00000000-0000-0000-0000-000000000201");
    static final UUID DRIVER2 = UUID.fromString("00000000-0000-0000-0000-000000000202");

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void goOfflineThenOnlineReturnsProfileAndStoresLocation() throws Exception {
        perform("/api/drivers/me/offline", DRIVER1, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(DRIVER1.toString()))
                .andExpect(jsonPath("$.isOnline").value(false))
                .andExpect(jsonPath("$.status").value("APPROVED"));
        assertThat(row(DRIVER1).get("is_online")).isEqualTo(false);

        perform("/api/drivers/me/online", DRIVER1, "{\"lat\":40.5011,\"lng\":-74.4482}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isOnline").value(true))
                .andExpect(jsonPath("$.lat").value(40.5011))
                .andExpect(jsonPath("$.lng").value(-74.4482))
                .andExpect(jsonPath("$.plate").value("R23-HKP"))
                .andExpect(jsonPath("$.carMake").value("Honda"))
                .andExpect(jsonPath("$.licenseNumber").exists());
        Map<String, Object> row = row(DRIVER1);
        assertThat(row.get("is_online")).isEqualTo(true);
        assertThat(row.get("current_lat")).isEqualTo(40.5011);
        assertThat(row.get("last_seen_at")).isNotNull();
        // other drivers untouched
        assertThat(row(DRIVER2).get("current_lat")).isEqualTo(40.5226);
    }

    @Test
    void locationUpdateReturns204AndBumpsLastSeen() throws Exception {
        jdbc.update("UPDATE driver_profiles SET last_seen_at = '2020-01-01T00:00:00Z' WHERE user_id = ?", DRIVER1);
        perform("/api/drivers/me/location", DRIVER1, "{\"lat\":40.51,\"lng\":-74.45}")
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));
        Map<String, Object> row = row(DRIVER1);
        assertThat(row.get("current_lat")).isEqualTo(40.51);
        assertThat(row.get("current_lng")).isEqualTo(-74.45);
        assertThat(((Timestamp) row.get("last_seen_at")).toInstant().getEpochSecond())
                .isGreaterThan(Timestamp.valueOf("2021-01-01 00:00:00").toInstant().getEpochSecond());
    }

    @Test
    void notApprovedOrNoProfileIs409() throws Exception {
        // rider1 has no driver profile
        for (String path : new String[]{"/api/drivers/me/online", "/api/drivers/me/location"}) {
            perform(path, RIDER1, "{\"lat\":40.5,\"lng\":-74.4}")
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.error").value("DRIVER_NOT_ONBOARDED"));
        }
        perform("/api/drivers/me/offline", RIDER1, null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("DRIVER_NOT_ONBOARDED"));

        jdbc.update("UPDATE driver_profiles SET status = 'PENDING', is_online = false WHERE user_id = ?", DRIVER1);
        perform("/api/drivers/me/online", DRIVER1, "{\"lat\":40.5,\"lng\":-74.4}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("DRIVER_NOT_ONBOARDED"));
        assertThat(row(DRIVER1).get("is_online")).isEqualTo(false);
    }

    @Test
    void missingOrOutOfRangeCoordinatesAreValidationErrors() throws Exception {
        for (String body : new String[]{"{}", "{\"lat\":40.5}", "{\"lat\":91,\"lng\":-74.4}", "{\"lat\":40.5,\"lng\":-181}"}) {
            perform("/api/drivers/me/online", DRIVER1, body)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        }
        perform("/api/drivers/me/location", DRIVER1, "{\"lng\":-74.4}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(post("/api/drivers/me/offline")).andExpect(status().isUnauthorized());
    }

    private ResultActions perform(String path, UUID user, String body) throws Exception {
        var request = post(path).header("X-Demo-User", user.toString());
        if (body != null) {
            request = request.contentType("application/json").content(body);
        }
        return mvc.perform(request);
    }

    private Map<String, Object> row(UUID driverId) {
        return jdbc.queryForMap("SELECT * FROM driver_profiles WHERE user_id = ?", driverId);
    }
}
