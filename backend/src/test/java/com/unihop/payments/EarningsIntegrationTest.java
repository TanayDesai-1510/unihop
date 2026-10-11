package com.unihop.payments;

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@Transactional
class EarningsIntegrationTest {
    private static final String DRIVER1 = "00000000-0000-0000-0000-000000000201";
    private static final String DRIVER1_CARD = "00000000-0000-0000-0000-000000000411";
    private static final String DRIVER2_CARD = "00000000-0000-0000-0000-000000000412";

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @Test
    void getCalculatesBalancePeriodsAndCompletedRidesNewestFirst() throws Exception {
        UUID olderRide = insertRide("COMPLETED", "2 hours", "4.50", "4.00");
        UUID newerRide = insertRide("COMPLETED", "1 hour", "6.50", "4.50");
        insertRide("CANCELLED", "30 minutes", "5.50", "3.60");
        insertEarning(olderRide, "RIDE_EARNING", "2.00", "8 days");
        insertEarning(newerRide, "RIDE_EARNING", "4.50", null);
        insertEarning(null, "PAYOUT", "-1.50", null);

        mvc.perform(get("/api/me/earnings").header("X-Demo-User", DRIVER1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.balance").value(5.00))
                .andExpect(jsonPath("$.today").value(4.50))
                .andExpect(jsonPath("$.week").value(4.50))
                .andExpect(jsonPath("$.total").value(6.50))
                .andExpect(jsonPath("$.rides.length()").value(2))
                .andExpect(jsonPath("$.rides[0].id").value(newerRide.toString()))
                .andExpect(jsonPath("$.rides[0].status").value("COMPLETED"))
                .andExpect(jsonPath("$.rides[0].pickupHubName").value("The Yard"))
                .andExpect(jsonPath("$.rides[0].dropoffHubName").value("Busch Student Center"))
                .andExpect(jsonPath("$.rides[0].total").value(6.50))
                .andExpect(jsonPath("$.rides[0].driverPayout").value(4.50))
                .andExpect(jsonPath("$.rides[0].completedAt").isNotEmpty())
                .andExpect(jsonPath("$.rides[0].requestedAt").isNotEmpty())
                .andExpect(jsonPath("$.rides[1].id").value(olderRide.toString()));
        mvc.perform(get("/api/me/earnings")).andExpect(status().isUnauthorized());
    }

    @Test
    void emptyLedgerReturnsZeroAmountsAndNoRides() throws Exception {
        mvc.perform(get("/api/me/earnings").header("X-Demo-User", DRIVER1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.balance").value(0.00))
                .andExpect(jsonPath("$.today").value(0.00))
                .andExpect(jsonPath("$.week").value(0.00))
                .andExpect(jsonPath("$.total").value(0.00))
                .andExpect(jsonPath("$.rides.length()").value(0));
    }

    @Test
    void cashOutPaysWholeBalanceAndWritesPayoutExactlyOnce() throws Exception {
        UUID ride = insertRide("COMPLETED", "1 hour", "8.50", "6.30");
        insertEarning(ride, "RIDE_EARNING", "12.75", null);

        mvc.perform(post("/api/me/earnings/cashout").header("X-Demo-User", DRIVER1)
                        .contentType("application/json")
                        .content("{\"paymentMethodId\":\"" + DRIVER1_CARD + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.balance").value(0.00))
                .andExpect(jsonPath("$.payoutAmount").value(12.75))
                .andExpect(jsonPath("$.methodLabel").value("Visa •••• 5556"));

        Map<String, Object> payout = jdbc.queryForMap("""
                SELECT amount, payment_method_id FROM driver_earnings
                WHERE driver_id = ?::uuid AND type = 'PAYOUT'
                """, DRIVER1);
        assertThat(payout.get("amount")).isEqualTo(new BigDecimal("-12.75"));
        assertThat(payout.get("payment_method_id")).isEqualTo(UUID.fromString(DRIVER1_CARD));
        assertThat(jdbc.queryForMap("""
                SELECT token, amount, status FROM mockpay_charges WHERE status = 'PAID_OUT'
                """)).containsEntry("token", "tok_seed_driver1_debit")
                .containsEntry("amount", new BigDecimal("12.75"))
                .containsEntry("status", "PAID_OUT");

        mvc.perform(post("/api/me/earnings/cashout").header("X-Demo-User", DRIVER1)
                        .contentType("application/json")
                        .content("{\"paymentMethodId\":\"" + DRIVER1_CARD + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("NOTHING_TO_CASH_OUT"));
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM driver_earnings
                WHERE driver_id = ?::uuid AND type = 'PAYOUT'
                """, Integer.class, DRIVER1)).isEqualTo(1);
    }

    @Test
    void cashOutValidatesBalanceMethodOwnershipAndBody() throws Exception {
        mvc.perform(post("/api/me/earnings/cashout").header("X-Demo-User", DRIVER1)
                        .contentType("application/json")
                        .content("{\"paymentMethodId\":\"" + DRIVER1_CARD + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("NOTHING_TO_CASH_OUT"));

        insertEarning(null, "RIDE_EARNING", "5.00", null);
        mvc.perform(post("/api/me/earnings/cashout").header("X-Demo-User", DRIVER1)
                        .contentType("application/json")
                        .content("{\"paymentMethodId\":\"" + DRIVER2_CARD + "\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("NOT_FOUND"));
        mvc.perform(post("/api/me/earnings/cashout").header("X-Demo-User", DRIVER1)
                        .contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM mockpay_charges", Integer.class)).isZero();
    }

    private UUID insertRide(String status, String age, String total, String payout) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO rides
                    (id, rider_id, driver_id, pickup_hub_id, dropoff_hub_id, status, fare_total,
                     platform_fee, base_fare, driver_payout, platform_margin, share_token,
                     requested_at, completed_at)
                VALUES (?, '00000000-0000-0000-0000-000000000101', ?::uuid,
                        '00000000-0000-0000-0000-000000000301',
                        '00000000-0000-0000-0000-000000000302', ?, ?::numeric, 1.50,
                        (?::numeric - 1.50), ?::numeric, (?::numeric - ?::numeric), ?,
                        now() - ?::interval,
                        CASE WHEN ? = 'COMPLETED' THEN now() ELSE NULL END)
                """, id, DRIVER1, status, total, total, payout, total, payout,
                "share-" + id, age, status);
        return id;
    }

    private void insertEarning(UUID rideId, String type, String amount, String age) {
        if (age == null) {
            jdbc.update("""
                    INSERT INTO driver_earnings (id, driver_id, ride_id, type, amount)
                    VALUES (?, ?::uuid, ?, ?, ?::numeric)
                    """, UUID.randomUUID(), DRIVER1, rideId, type, amount);
        } else {
            jdbc.update("""
                    INSERT INTO driver_earnings (id, driver_id, ride_id, type, amount, created_at)
                    VALUES (?, ?::uuid, ?, ?, ?::numeric, now() - ?::interval)
                    """, UUID.randomUUID(), DRIVER1, rideId, type, amount, age);
        }
    }
}
