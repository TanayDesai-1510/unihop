package com.unihop.driver;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@Transactional
class DriverOnboardingIntegrationTest {
    static final String RIDER = "00000000-0000-0000-0000-000000000101";
    static final String DRIVER = "00000000-0000-0000-0000-000000000201";
    static final Map<String, String> VALID = Map.of("licenseNumber", "D123456", "carMake", "Honda",
            "carModel", "Civic", "carColor", "Blue", "plate", "ABC123");
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;

    @Test void onboardCreatesApprovedProfileAndEnablesModeSwitch() throws Exception {
        mvc.perform(get("/api/drivers/me").header("X-Demo-User", RIDER))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("NOT_FOUND"));
        String response = mvc.perform(post("/api/drivers/onboard").header("X-Demo-User", RIDER)
                        .contentType("application/json").content(mapper.writeValueAsString(VALID)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.userId").value(RIDER))
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.isOnline").value(false)).andReturn().getResponse().getContentAsString();
        var profile = mapper.readTree(response);
        assertThat(profile.size()).isEqualTo(10);
        assertThat(profile.get("lat").isNull()).isTrue();
        assertThat(profile.get("lng").isNull()).isTrue();
        mvc.perform(get("/api/drivers/me").header("X-Demo-User", RIDER))
                .andExpect(status().isOk()).andExpect(content().json(response));
        mvc.perform(patch("/api/users/me").header("X-Demo-User", RIDER).contentType("application/json")
                        .content("{\"mode\":\"DRIVER\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.mode").value("DRIVER"));
    }
    @Test void repeatOnboardingPreservesAvailabilityAndLocation() throws Exception {
        UUID id = UUID.fromString(DRIVER);
        var before = jdbc.queryForMap("SELECT is_online, current_lat, current_lng, last_seen_at FROM driver_profiles WHERE user_id = ?", id);
        for (int i = 0; i < 2; i++) {
            mvc.perform(post("/api/drivers/onboard").header("X-Demo-User", DRIVER).contentType("application/json")
                            .content(mapper.writeValueAsString(VALID)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.plate").value("ABC123"));
        }
        assertThat(jdbc.queryForMap("SELECT is_online, current_lat, current_lng, last_seen_at FROM driver_profiles WHERE user_id = ?", id))
                .isEqualTo(before);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM driver_profiles WHERE user_id = ?", Integer.class, id)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM driver_profiles WHERE user_id = ?", Integer.class, UUID.fromString(RIDER))).isZero();
    }
    @Test void validatesEveryRequiredFieldAndLength() throws Exception {
        for (String field : VALID.keySet()) {
            for (String value : new String[]{null, " ", "x".repeat(51)}) {
                var body = new HashMap<>(VALID);
                body.put(field, value);
                mvc.perform(post("/api/drivers/onboard").header("X-Demo-User", RIDER).contentType("application/json")
                                .content(mapper.writeValueAsString(body)))
                        .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
            }
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM driver_profiles WHERE user_id = ?", Integer.class, UUID.fromString(RIDER))).isZero();
    }
    @Test void requiresAuthAndRejectsUnknownUser() throws Exception {
        mvc.perform(get("/api/drivers/me")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/drivers/onboard").contentType("application/json").content(mapper.writeValueAsString(VALID)))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/drivers/onboard").header("X-Demo-User", UUID.randomUUID().toString())
                        .contentType("application/json").content(mapper.writeValueAsString(VALID)))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("NOT_FOUND"));
    }
}
