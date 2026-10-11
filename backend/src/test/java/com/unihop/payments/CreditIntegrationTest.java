package com.unihop.payments;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@Transactional
class CreditIntegrationTest {
    private static final String RIDER1 = "00000000-0000-0000-0000-000000000101";
    private static final String RIDER2 = "00000000-0000-0000-0000-000000000102";
    private static final String RIDER1_VISA = "00000000-0000-0000-0000-000000000401";
    private static final String RIDER2_OLD_CARD = "00000000-0000-0000-0000-000000000404";

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @Test
    void getReturnsSeededBalanceAndNewestFirstContractLedger() throws Exception {
        UUID older = UUID.fromString("10000000-0000-0000-0000-000000000001");
        UUID newest = UUID.fromString("20000000-0000-0000-0000-000000000001");
        jdbc.update("""
                INSERT INTO credit_transactions (id, user_id, type, amount, created_at)
                VALUES (?, ?::uuid, 'TOPUP', 10.00, now() + interval '1 minute'),
                       (?, ?::uuid, 'RIDE_REFUND', 2.50, now() + interval '2 minutes')
                """, older, RIDER1, newest, RIDER1);

        mvc.perform(get("/api/credits").header("X-Demo-User", RIDER1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.balance").value(17.50))
                .andExpect(jsonPath("$.transactions.length()").value(3))
                .andExpect(jsonPath("$.transactions[0].id").value(newest.toString()))
                .andExpect(jsonPath("$.transactions[0].type").value("RIDE_REFUND"))
                .andExpect(jsonPath("$.transactions[0].amount").value(2.50))
                .andExpect(jsonPath("$.transactions[0].rideId").value(nullValue()))
                .andExpect(jsonPath("$.transactions[0].createdAt").isNotEmpty())
                .andExpect(jsonPath("$.transactions[1].id").value(older.toString()))
                .andExpect(jsonPath("$.transactions[2].type").value("PROMO"));
        mvc.perform(get("/api/credits")).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @ValueSource(ints = {10, 20, 50})
    void topUpAcceptsContractAmountsCapturesChargeAndAddsLedgerEntry(int amount) throws Exception {
        mvc.perform(post("/api/credits/topup").header("X-Demo-User", RIDER1)
                        .contentType("application/json")
                        .content("{\"amount\":" + amount + ",\"paymentMethodId\":\"" + RIDER1_VISA + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.balance").value(amount + 5.0))
                .andExpect(jsonPath("$.transactions[0].type").value("TOPUP"))
                .andExpect(jsonPath("$.transactions[0].amount").value(amount))
                .andExpect(jsonPath("$.transactions[0].rideId").value(nullValue()));

        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM credit_transactions
                WHERE user_id = ?::uuid AND type = 'TOPUP' AND amount = ?
                """, Integer.class, RIDER1, new BigDecimal(amount))).isEqualTo(1);
        assertThat(jdbc.queryForMap("""
                SELECT token, amount, status FROM mockpay_charges ORDER BY created_at DESC LIMIT 1
                """)).containsEntry("token", "tok_seed_rider1_visa")
                .containsEntry("amount", new BigDecimal(amount).setScale(2))
                .containsEntry("status", "CAPTURED");
    }

    @Test
    void declineReturnsContractErrorAndCreatesNoCreditOrCharge() throws Exception {
        mvc.perform(post("/api/credits/topup").header("X-Demo-User", RIDER2)
                        .contentType("application/json")
                        .content("{\"amount\":20,\"paymentMethodId\":\"" + RIDER2_OLD_CARD + "\"}"))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.error").value("PAYMENT_DECLINED"))
                .andExpect(jsonPath("$.declineCode").value("CARD_DECLINED"));

        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM credit_transactions WHERE user_id = ?::uuid AND type = 'TOPUP'
                """, Integer.class, RIDER2)).isZero();
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM mockpay_charges WHERE token = 'tok_seed_rider2_oldcard'
                """, Integer.class)).isZero();
    }

    @Test
    void invalidAmountsAreRejectedWithoutCharging() throws Exception {
        for (String amount : new String[]{"0", "5", "10.01", "100"}) {
            mvc.perform(post("/api/credits/topup").header("X-Demo-User", RIDER1)
                            .contentType("application/json")
                            .content("{\"amount\":" + amount + ",\"paymentMethodId\":\"" + RIDER1_VISA + "\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        }
        mvc.perform(post("/api/credits/topup").header("X-Demo-User", RIDER1)
                        .contentType("application/json")
                        .content("{\"paymentMethodId\":\"" + RIDER1_VISA + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM mockpay_charges", Integer.class)).isZero();
    }

    @Test
    void topUpRequiresAnActiveMethodOwnedByTheCaller() throws Exception {
        mvc.perform(post("/api/credits/topup").header("X-Demo-User", RIDER2)
                        .contentType("application/json")
                        .content("{\"amount\":10,\"paymentMethodId\":\"" + RIDER1_VISA + "\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("NOT_FOUND"));
        mvc.perform(post("/api/credits/topup").header("X-Demo-User", RIDER1)
                        .contentType("application/json").content("{\"amount\":10}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }
}
