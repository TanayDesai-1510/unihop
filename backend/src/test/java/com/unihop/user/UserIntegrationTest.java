package com.unihop.user;

import com.unihop.auth.JwtTokenIssuer;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@Transactional
class UserIntegrationTest {
    static final String RIDER = "00000000-0000-0000-0000-000000000101";
    static final String DRIVER = "00000000-0000-0000-0000-000000000201";
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtTokenIssuer tokens;

    @Test void profileUsesJwtCallerAndReportsApproval() throws Exception {
        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + tokens.issue(UUID.fromString(RIDER))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(RIDER))
                .andExpect(jsonPath("$.email").value("rider1@scarletmail.rutgers.edu"))
                .andExpect(jsonPath("$.isDriverApproved").value(false));
        mvc.perform(get("/api/users/me").header("X-Demo-User", DRIVER))
                .andExpect(status().isOk()).andExpect(jsonPath("$.isDriverApproved").value(true));
        mvc.perform(get("/api/users/me")).andExpect(status().isUnauthorized());
    }
    @Test void patchPreservesOmittedFieldsAndOtherUsers() throws Exception {
        mvc.perform(patch("/api/users/me").header("X-Demo-User", RIDER).contentType("application/json")
                        .content("{\"name\":\" Updated Rider \",\"phone\":\"555-0100\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Updated Rider"))
                .andExpect(jsonPath("$.phone").value("555-0100")).andExpect(jsonPath("$.mode").value("RIDER"));
        mvc.perform(patch("/api/users/me").header("X-Demo-User", RIDER).contentType("application/json").content("{}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Updated Rider"));
        assertThat(jdbc.queryForObject("SELECT name FROM users WHERE id = ?", String.class, UUID.fromString(DRIVER)))
                .isEqualTo("Alex Kim");
    }
    @Test void missingOrPendingProfileCannotSwitchAndFailedPatchIsAtomic() throws Exception {
        rejectDriver(RIDER);
        jdbc.update("UPDATE driver_profiles SET status = 'PENDING' WHERE user_id = ?", UUID.fromString(DRIVER));
        rejectDriver(DRIVER);
        assertThat(jdbc.queryForObject("SELECT name FROM users WHERE id = ?", String.class, UUID.fromString(RIDER)))
                .isEqualTo("Jordan Patel");
        mvc.perform(get("/api/users/me").header("X-Demo-User", DRIVER))
                .andExpect(jsonPath("$.isDriverApproved").value(false));
    }
    private void rejectDriver(String id) throws Exception {
        mvc.perform(patch("/api/users/me").header("X-Demo-User", id).contentType("application/json")
                        .content("{\"mode\":\"DRIVER\",\"name\":\"Must not persist\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("DRIVER_NOT_ONBOARDED"));
    }
    @Test void approvedDriverCanSwitchBothWaysWithoutChangingAvailability() throws Exception {
        for (String mode : new String[]{"RIDER", "DRIVER"}) {
            mvc.perform(patch("/api/users/me").header("X-Demo-User", DRIVER).contentType("application/json")
                            .content("{\"mode\":\"" + mode + "\"}"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.mode").value(mode));
        }
        assertThat(jdbc.queryForObject("SELECT is_online FROM driver_profiles WHERE user_id = ?", Boolean.class,
                UUID.fromString(DRIVER))).isTrue();
    }
    @Test void badInputAndUnknownUserUseContractErrors() throws Exception {
        for (String body : new String[]{"{\"mode\":\"ADMIN\"}", "{\"name\":\"  \"}",
                "{\"phone\":\"" + "1".repeat(33) + "\"}"}) {
            mvc.perform(patch("/api/users/me").header("X-Demo-User", RIDER).contentType("application/json").content(body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        }
        mvc.perform(get("/api/users/me").header("X-Demo-User", UUID.randomUUID().toString()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("NOT_FOUND"));
    }
}
