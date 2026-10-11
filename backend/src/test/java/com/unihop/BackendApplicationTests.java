package com.unihop;

import com.unihop.pricing.FareBreakdown;
import com.unihop.pricing.FareService;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.UUID;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Boots the full app against embedded Postgres so Flyway V1/V2 run for real. No Docker needed. */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class BackendApplicationTests {

    static final UUID YARD = UUID.fromString("00000000-0000-0000-0000-000000000301");
    static final UUID BUSCH_SC = UUID.fromString("00000000-0000-0000-0000-000000000302");
    static final UUID COOK_CC = UUID.fromString("00000000-0000-0000-0000-000000000304");
    static final UUID DOUGLASS_SC = UUID.fromString("00000000-0000-0000-0000-000000000305");

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    FareService fareService;

    @Test
    void healthReturnsOk() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    void unknownEndpointUsesContractErrorFormat() throws Exception {
        mvc.perform(get("/api/does-not-exist")
                        .header("X-Demo-User", "00000000-0000-0000-0000-000000000101"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    void seedDataIsLoaded() {
        assertThat(count("users")).isEqualTo(7);
        assertThat(count("hubs")).isEqualTo(6);
        assertThat(count("fares")).isEqualTo(25);
        assertThat(count("driver_profiles WHERE status = 'APPROVED' AND is_online")).isEqualTo(5);
        assertThat(count("payment_methods")).isEqualTo(9);
        assertThat(count("mockpay_vault")).isEqualTo(9);
        assertThat(count("payment_methods WHERE is_default")).isEqualTo(7);
        BigDecimal rider1Credits = jdbc.queryForObject(
                "SELECT sum(amount) FROM credit_transactions WHERE user_id = '00000000-0000-0000-0000-000000000101'",
                BigDecimal.class);
        assertThat(rider1Credits).isEqualByComparingTo("5.00");
    }

    @Test
    void everySeededFareIsUnderTenAndSymmetric() {
        assertThat(count("fares WHERE price >= 10")).isZero();
        assertThat(count("fares f JOIN fares r ON f.from_zone = r.to_zone AND f.to_zone = r.from_zone AND f.price <> r.price")).isZero();
    }

    @Test
    void fareServiceQuotesFromTheTable() {
        assertThat(fareService.quote(BUSCH_SC, COOK_CC))
                .isEqualTo(FareBreakdown.fromTotal(new BigDecimal("8.50")));
        assertThat(fareService.quote(YARD, BUSCH_SC).total()).isEqualByComparingTo("6.50");
        // Cook and Douglass share a zone: diagonal price
        assertThat(fareService.quote(COOK_CC, DOUGLASS_SC).total()).isEqualByComparingTo("4.50");
    }

    private int count(String fromClause) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM " + fromClause, Integer.class);
        return n == null ? 0 : n;
    }
}
