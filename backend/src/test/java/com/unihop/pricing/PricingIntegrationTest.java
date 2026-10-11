package com.unihop.pricing;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;
import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class PricingIntegrationTest {
    static final String RIDER = "00000000-0000-0000-0000-000000000101";
    static final String[] ZONES = {"COLLEGE_AVE", "BUSCH", "LIVINGSTON", "COOK_DOUGLASS", "DOWNTOWN"};
    static final String[][] PRICES = {
            {"4.50", "6.50", "6.50", "6.50", "4.50"},
            {"6.50", "4.50", "5.50", "8.50", "6.50"},
            {"6.50", "5.50", "4.50", "8.50", "6.50"},
            {"6.50", "8.50", "8.50", "4.50", "5.50"},
            {"4.50", "6.50", "6.50", "5.50", "4.50"}};
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired FareService fares;
    static UUID hub(int number) { return UUID.fromString("00000000-0000-0000-0000-000000000" + number); }

    @Test void hubsArePublicAndHaveContractFields() throws Exception {
        mvc.perform(get("/api/hubs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(6))
                .andExpect(jsonPath("$[0].id").value(hub(301).toString()))
                .andExpect(jsonPath("$[0].code").value("YARD"))
                .andExpect(jsonPath("$[0].name").value("The Yard"))
                .andExpect(jsonPath("$[0].zone").value("COLLEGE_AVE"))
                .andExpect(jsonPath("$[0].lat").value(40.4998))
                .andExpect(jsonPath("$[0].lng").value(-74.4479));
    }

    @Test void all25SeededZonePairsMatchContractAndAreSymmetricUnderTen() {
        assertThat(jdbc.queryForObject("SELECT count(*) FROM fares", Integer.class)).isEqualTo(25);
        for (int from = 0; from < 5; from++) {
            for (int to = 0; to < 5; to++) {
                BigDecimal price = jdbc.queryForObject("SELECT price FROM fares WHERE from_zone = ? AND to_zone = ?",
                        BigDecimal.class, ZONES[from], ZONES[to]);
                assertThat(price).isEqualByComparingTo(PRICES[from][to]).isLessThan(new BigDecimal("10.00"));
                assertThat(price).isEqualByComparingTo(PRICES[to][from]);
            }
        }
    }

    @Test void everyDistinctHubPairUsesCorrectZonesAndFareMath() {
        int[] zoneIndex = {0, 1, 2, 3, 3, 4};
        for (int from = 0; from < 6; from++) {
            for (int to = 0; to < 6; to++) {
                if (from == to) continue;
                FareBreakdown fare = fares.quote(hub(301 + from), hub(301 + to));
                BigDecimal total = new BigDecimal(PRICES[zoneIndex[from]][zoneIndex[to]]);
                BigDecimal base = total.subtract(new BigDecimal("1.50"));
                BigDecimal payout = base.multiply(new BigDecimal("0.90")).setScale(2, RoundingMode.HALF_UP);
                assertThat(fare.total()).isEqualTo(total);
                assertThat(fare.platformFee()).isEqualTo(new BigDecimal("1.50"));
                assertThat(fare.baseFare()).isEqualTo(base);
                assertThat(fare.driverPayout()).isEqualTo(payout);
                assertThat(fare.platformMargin()).isEqualTo(total.subtract(payout));
                assertThat(fare).isEqualTo(fares.quote(hub(301 + to), hub(301 + from)));
            }
        }
    }

    @Test void quoteHttpResponseAndErrorsFollowContract() throws Exception {
        mvc.perform(get("/api/fares/quote").param("from", hub(301).toString()).param("to", hub(302).toString())
                        .header("X-Demo-User", RIDER)).andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(6.50)).andExpect(jsonPath("$.platformFee").value(1.50))
                .andExpect(jsonPath("$.baseFare").value(5.00)).andExpect(jsonPath("$.driverPayout").value(4.50))
                .andExpect(jsonPath("$.platformMargin").value(2.00));
        for (String[] pair : new String[][]{{hub(301).toString(), hub(301).toString(), "SAME_HUB"},
                {UUID.randomUUID().toString(), hub(302).toString(), "HUB_NOT_FOUND"},
                {hub(301).toString(), UUID.randomUUID().toString(), "HUB_NOT_FOUND"},
                {"invalid", hub(302).toString(), "VALIDATION_ERROR"}}) {
            mvc.perform(get("/api/fares/quote").header("X-Demo-User", RIDER).param("from", pair[0]).param("to", pair[1]))
                    .andExpect(status().is(pair[2].equals("HUB_NOT_FOUND") ? 404 : 400))
                    .andExpect(jsonPath("$.error").value(pair[2]));
        }
        mvc.perform(get("/api/fares/quote").header("X-Demo-User", RIDER))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        mvc.perform(get("/api/fares/quote").param("from", hub(301).toString()).param("to", hub(302).toString()))
                .andExpect(status().isUnauthorized());
    }
}
