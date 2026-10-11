package com.unihop.mockpay;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.unihop.common.ApiException;
import com.unihop.common.enums.DeclineCode;
import com.unihop.payments.PaymentDeclinedException;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@Transactional
class MockPayIntegrationTest {
    private static final Map<String, String[]> TEST_CARDS = Map.of(
            "4242424242424242", new String[]{"VISA", "4242", "SUCCESS", "123"},
            "5555555555554444", new String[]{"MASTERCARD", "4444", "SUCCESS", "123"},
            "378282246310005", new String[]{"AMEX", "0005", "SUCCESS", "1234"},
            "6011111111111117", new String[]{"DISCOVER", "1117", "SUCCESS", "123"},
            "4000000000000002", new String[]{"VISA", "0002", "CARD_DECLINED", "123"},
            "4000000000009995", new String[]{"VISA", "9995", "INSUFFICIENT_FUNDS", "123"},
            "4000000000000069", new String[]{"VISA", "0069", "EXPIRED_CARD", "123"},
            "4000000000000127", new String[]{"VISA", "0127", "INCORRECT_CVC", "123"});

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockPaymentGateway gateway;

    @Test
    void tokenizesEveryContractTestCardWithoutStoringSensitiveData() throws Exception {
        int before = count("mockpay_vault");
        for (var entry : TEST_CARDS.entrySet()) {
            String number = entry.getKey();
            String[] expected = entry.getValue();
            JsonNode token = tokenize(number, expected[3]);
            assertThat(token.get("token").asText()).startsWith("tok_");
            assertThat(token.get("brand").asText()).isEqualTo(expected[0]);
            assertThat(token.get("last4").asText()).isEqualTo(expected[1]);
            assertThat(token.get("expMonth").asInt()).isEqualTo(12);
            assertThat(token.get("expYear").asInt()).isEqualTo(2099);
            assertThat(token.get("walletType").isNull()).isTrue();

            Map<String, Object> stored = jdbc.queryForMap(
                    "SELECT brand, last4, exp_month, exp_year, wallet_type, behavior FROM mockpay_vault WHERE token = ?",
                    token.get("token").asText());
            assertThat(stored.get("brand")).isEqualTo(expected[0]);
            assertThat(stored.get("last4").toString().trim()).isEqualTo(expected[1]);
            assertThat(stored.get("behavior")).isEqualTo(expected[2]);
            assertThat(stored).doesNotContainKeys("number", "cvc");
        }
        assertThat(count("mockpay_vault")).isEqualTo(before + TEST_CARDS.size());
    }

    @Test
    void tokenizationErrorsUseContractCodesAndDoNotWriteVaultRows() throws Exception {
        int before = count("mockpay_vault");
        assertTokenError(Map.of("number", "4242424242424241", "expMonth", 12, "expYear", 2099,
                "cvc", "123"), "INVALID_NUMBER");
        assertTokenError(Map.of("number", "4242424242424242", "expMonth", 13, "expYear", 2099,
                "cvc", "123"), "INVALID_EXPIRY");
        assertTokenError(Map.of("number", "4242424242424242", "expMonth", 12, "expYear", 2099,
                "cvc", "12"), "INVALID_CVC");
        assertTokenError(Map.of("number", "378282246310005", "expMonth", 12, "expYear", 2099,
                "cvc", "123"), "INVALID_CVC");
        assertThat(count("mockpay_vault")).isEqualTo(before);
    }

    @Test
    void createsPublicSuccessWalletTokensForBothSupportedWallets() throws Exception {
        for (String wallet : new String[]{"APPLE_PAY", "GOOGLE_PAY"}) {
            String response = mvc.perform(post("/mockpay/v1/wallet-tokens")
                            .contentType("application/json")
                            .content(mapper.writeValueAsString(Map.of("walletType", wallet))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.brand").value("VISA"))
                    .andExpect(jsonPath("$.last4").value(org.hamcrest.Matchers.matchesPattern("[0-9]{4}")))
                    .andExpect(jsonPath("$.walletType").value(wallet))
                    .andReturn().getResponse().getContentAsString();
            String token = mapper.readTree(response).get("token").asText();
            assertThat(jdbc.queryForObject("SELECT behavior FROM mockpay_vault WHERE token = ?",
                    String.class, token)).isEqualTo("SUCCESS");
        }
        mvc.perform(post("/mockpay/v1/wallet-tokens").contentType("application/json")
                        .content("{\"walletType\":\"CARD\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    void authorizationDeclinesAtChargeTimeAndSuccessfulCallsAreIdempotent() throws Exception {
        String successToken = tokenize("4242424242424242", "123").get("token").asText();
        String declineToken = tokenize("4000000000000002", "123").get("token").asText();

        assertThatThrownBy(() -> gateway.authorize(declineToken, new BigDecimal("6.50"), "decline-key"))
                .isInstanceOfSatisfying(PaymentDeclinedException.class,
                        error -> assertThat(error.getDeclineCode()).isEqualTo(DeclineCode.CARD_DECLINED));
        assertThat(count("mockpay_charges")).isZero();

        String charge = gateway.authorize(successToken, new BigDecimal("6.50"), "ride-1");
        assertThat(gateway.authorize(successToken, new BigDecimal("6.500"), "ride-1")).isEqualTo(charge);
        assertThat(count("mockpay_charges")).isEqualTo(1);
        gateway.capture(charge);
        gateway.capture(charge);
        assertThat(chargeStatus(charge)).isEqualTo("CAPTURED");
        assertThatThrownBy(() -> gateway.voidAuthorization(charge))
                .isInstanceOfSatisfying(ApiException.class,
                        error -> assertThat(error.getCode()).isEqualTo("INVALID_TRANSITION"));
    }

    @Test
    void voidAndPayoutAreIdempotentAndRejectKeyReuseWithDifferentParameters() throws Exception {
        String token = tokenize("5555555555554444", "123").get("token").asText();
        String charge = gateway.authorize(token, new BigDecimal("5.50"), "ride-2");
        gateway.voidAuthorization(charge);
        gateway.voidAuthorization(charge);
        assertThat(chargeStatus(charge)).isEqualTo("VOIDED");

        String payout = gateway.payout(token, new BigDecimal("12.34"), "payout-1");
        assertThat(payout).startsWith("po_");
        assertThat(gateway.payout(token, new BigDecimal("12.34"), "payout-1")).isEqualTo(payout);
        assertThat(chargeStatus(payout)).isEqualTo("PAID_OUT");
        assertThat(count("mockpay_charges")).isEqualTo(2);

        assertThatThrownBy(() -> gateway.payout(token, new BigDecimal("12.35"), "payout-1"))
                .isInstanceOfSatisfying(ApiException.class,
                        error -> assertThat(error.getCode()).isEqualTo("VALIDATION_ERROR"));
        assertThatThrownBy(() -> gateway.authorize(token, new BigDecimal("12.34"), "payout-1"))
                .isInstanceOfSatisfying(ApiException.class,
                        error -> assertThat(error.getCode()).isEqualTo("VALIDATION_ERROR"));
    }

    @Test
    void declineBehaviorAppliesOnlyToAuthorization() throws Exception {
        String token = tokenize("4000000000009995", "123").get("token").asText();
        assertThatThrownBy(() -> gateway.authorize(token, new BigDecimal("10.00"), "authorize-decline"))
                .isInstanceOfSatisfying(PaymentDeclinedException.class,
                        error -> assertThat(error.getDeclineCode()).isEqualTo(DeclineCode.INSUFFICIENT_FUNDS));
        assertThat(gateway.payout(token, new BigDecimal("10.00"), "payout-to-card")).startsWith("po_");
    }

    private JsonNode tokenize(String number, String cvc) throws Exception {
        String response = mvc.perform(post("/mockpay/v1/tokens")
                        .contentType("application/json")
                        .content(mapper.writeValueAsString(Map.of("number", number, "expMonth", 12,
                                "expYear", 2099, "cvc", cvc))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(response);
    }

    private void assertTokenError(Map<String, Object> body, String code) throws Exception {
        mvc.perform(post("/mockpay/v1/tokens").contentType("application/json")
                        .content(mapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(code));
    }

    private int count(String table) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class);
    }

    private String chargeStatus(String id) {
        return jdbc.queryForObject("SELECT status FROM mockpay_charges WHERE id = ?", String.class, id);
    }
}

