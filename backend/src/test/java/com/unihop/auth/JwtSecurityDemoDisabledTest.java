package com.unihop.auth;

import com.unihop.common.CurrentUser;
import com.unihop.common.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = JwtSecurityTest.Probe.class, properties = {
        "app.jwt.secret=test-secret-test-secret-test-secret-test-secret",
        "app.auth.demo-header=false", "app.cors.origins=http://localhost:3000"})
@Import({SecurityConfig.class, JwtSubjectReader.class, CurrentUser.class, JwtSecurityTest.Probe.class})
class JwtSecurityDemoDisabledTest {
    @Autowired MockMvc mvc;

    @Test void ignoresDemoHeaderButAcceptsJwt() throws Exception {
        mvc.perform(get("/api/security-probe").header("X-Demo-User", JwtSecurityTest.USER))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/security-probe").header("Authorization", "Bearer " + JwtSecurityTest.token(3600)))
                .andExpect(status().isOk());
    }
}
