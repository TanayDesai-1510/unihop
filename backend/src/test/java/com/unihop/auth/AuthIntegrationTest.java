package com.unihop.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import java.util.Map;
import java.util.UUID;
import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class AuthIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtSubjectReader tokens;

    String request(String email) throws Exception {
        return mapper.readTree(mvc.perform(post("/api/auth/request-otp").contentType("application/json")
                .content(mapper.writeValueAsString(Map.of("email", email))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("devOtp").asText();
    }
    JsonNode login(String email, String name) throws Exception {
        String code = request(email);
        return mapper.readTree(mvc.perform(post("/api/auth/verify-otp").contentType("application/json")
                .content(mapper.writeValueAsString(Map.of("email", email, "otp", code, "name", name))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
    @Test void firstLoginCreatesUserAndRepeatLoginKeepsIdentity() throws Exception {
        String email = UUID.randomUUID() + "@scarletmail.rutgers.edu";
        JsonNode response = login(email, "New Rider");
        JsonNode user = response.get("user");
        assertThat(user.size()).isEqualTo(8);
        assertThat(user.get("name").asText()).isEqualTo("New Rider");
        assertThat(user.get("phone").isNull()).isTrue();
        assertThat(user.get("mode").asText()).isEqualTo("RIDER");
        assertThat(user.get("ratingAvg").decimalValue()).isEqualByComparingTo("5.00");
        assertThat(user.get("ratingCount").asInt()).isZero();
        assertThat(user.get("isDriverApproved").asBoolean()).isFalse();
        assertThat(tokens.subject(response.get("token").asText()).toString()).isEqualTo(user.get("id").asText());
        assertThat(login(email, "Changed").get("user")).isEqualTo(user);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users WHERE email = ?", Integer.class, email)).isEqualTo(1);
    }
    @Test void seededDriverPreservesIdAndApproval() throws Exception {
        JsonNode user = login("driver1@scarletmail.rutgers.edu", "Ignored").get("user");
        assertThat(user.get("id").asText()).isEqualTo("00000000-0000-0000-0000-000000000201");
        assertThat(user.get("name").asText()).isEqualTo("Alex Kim");
        assertThat(user.get("mode").asText()).isEqualTo("DRIVER");
        assertThat(user.get("isDriverApproved").asBoolean()).isTrue();
    }
    @Test void optionalNameDefaultsToEmailLocalPartAndCodeIsSingleUse() throws Exception {
        String local = "rider-" + UUID.randomUUID();
        String email = local + "@scarletmail.rutgers.edu";
        String body = mapper.writeValueAsString(Map.of("email", email, "otp", request(email)));
        mvc.perform(post("/api/auth/verify-otp").contentType("application/json").content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.name").value(local));
        mvc.perform(post("/api/auth/verify-otp").contentType("application/json").content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_OTP"));
    }
    @Test void rejectsWrongOtpDomainAndMissingFields() throws Exception {
        mvc.perform(post("/api/auth/request-otp").contentType("application/json").content("{\"email\":\"x@gmail.com\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_EMAIL_DOMAIN"));
        mvc.perform(post("/api/auth/request-otp").contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        mvc.perform(post("/api/auth/verify-otp").contentType("application/json")
                .content("{\"email\":\"missing@scarletmail.rutgers.edu\",\"otp\":\"123456\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_OTP"));
    }
}
