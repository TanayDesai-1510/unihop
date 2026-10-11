package com.unihop.auth;

import com.unihop.common.CurrentUser;
import com.unihop.common.SecurityConfig;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = JwtSecurityTest.Probe.class, properties = {
        "app.jwt.secret=test-secret-test-secret-test-secret-test-secret",
        "app.auth.demo-header=true", "app.cors.origins=http://localhost:3000"})
@Import({SecurityConfig.class, JwtSubjectReader.class, CurrentUser.class, JwtSecurityTest.Probe.class})
class JwtSecurityTest {
    static final String USER = "00000000-0000-0000-0000-000000000101";
    @Autowired MockMvc mvc;

    @RestController
    static class Probe {
        private final CurrentUser user;
        Probe(CurrentUser user) { this.user = user; }
        @GetMapping("/api/security-probe") String protectedRoute() { return user.id().toString(); }
        @GetMapping({"/api/auth/probe", "/api/health", "/api/hubs", "/api/share/probe",
                "/mockpay/probe", "/ws", "/swagger-ui/probe", "/v3/api-docs/probe", "/actuator/health"})
        String publicRoute() { return "ok"; }
    }

    @Test void protectedRouteRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/security-probe")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").isString())
                .andExpect(jsonPath("$.declineCode").doesNotExist());
    }

    @Test void jwtAuthenticatesAndDoesNotPersistToNextRequest() throws Exception {
        mvc.perform(get("/api/security-probe").header("Authorization", "Bearer " + token(3600)))
                .andExpect(status().isOk()).andExpect(content().string(USER))
                .andExpect(cookie().doesNotExist("JSESSIONID"));
        mvc.perform(get("/api/security-probe")).andExpect(status().isUnauthorized());
    }

    @Test void demoHeaderAuthenticates() throws Exception {
        mvc.perform(get("/api/security-probe").header("X-Demo-User", USER))
                .andExpect(status().isOk()).andExpect(content().string(USER));
    }

    @Test void badCredentialsCannotFallBackToDemo() throws Exception {
        for (String authorization : new String[]{"Bearer broken", "Basic abc", "Bearer " + token(-60)}) {
            mvc.perform(get("/api/security-probe").header("Authorization", authorization)
                            .header("X-Demo-User", USER))
                    .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
        }
        mvc.perform(get("/api/security-probe").header("X-Demo-User", "bad"))
                .andExpect(status().isUnauthorized());
    }

    @Test void contractPublicRoutesDoNotRequireCredentials() throws Exception {
        for (String path : new String[]{"/api/auth/probe", "/api/health", "/api/hubs", "/api/share/probe",
                "/mockpay/probe", "/ws", "/swagger-ui/probe", "/v3/api-docs/probe", "/actuator/health"}) {
            mvc.perform(get(path)).andExpect(status().isOk());
        }
        mvc.perform(get("/api/hubs/private")).andExpect(status().isUnauthorized());
    }

    @Test void corsPreflightWorksWithoutAuthentication() throws Exception {
        mvc.perform(options("/api/security-probe").header("Origin", "http://localhost:3000")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "Authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"));
        mvc.perform(options("/api/security-probe").header("Origin", "https://untrusted.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
    }

    static String token(long seconds) {
        return Jwts.builder().subject(USER).expiration(Date.from(Instant.now().plusSeconds(seconds)))
                .signWith(Keys.hmacShaKeyFor("test-secret-test-secret-test-secret-test-secret"
                        .getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256).compact();
    }
}
