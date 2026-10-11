package com.unihop.payments;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@Transactional
class PaymentMethodIntegrationTest {
    private static final String RIDER1 = "00000000-0000-0000-0000-000000000101";
    private static final String RIDER2 = "00000000-0000-0000-0000-000000000102";
    private static final String RIDER1_VISA = "00000000-0000-0000-0000-000000000401";
    private static final String RIDER1_APPLE = "00000000-0000-0000-0000-000000000402";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;

    @Test
    void listIsCallerScopedWithDefaultFirstAndContractLabels() throws Exception {
        mvc.perform(get("/api/payment-methods").header("X-Demo-User", RIDER1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(RIDER1_VISA))
                .andExpect(jsonPath("$[0].isDefault").value(true))
                .andExpect(jsonPath("$[0].label").value("Visa •••• 4242"))
                .andExpect(jsonPath("$[1].id").value(RIDER1_APPLE))
                .andExpect(jsonPath("$[1].label").value("Apple Pay"));
        mvc.perform(get("/api/payment-methods").header("X-Demo-User", RIDER2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].label").value("Mastercard •••• 4444"));
        mvc.perform(get("/api/payment-methods")).andExpect(status().isUnauthorized());
    }

    @Test
    void firstSavedMethodBecomesDefaultAndWalletTypeComesFromVault() throws Exception {
        UUID user = insertUser();
        String walletToken = walletToken("GOOGLE_PAY");
        JsonNode method = add(user, walletToken, " Phone wallet ");
        assertThat(method.get("type").asText()).isEqualTo("GOOGLE_PAY");
        assertThat(method.get("brand").asText()).isEqualTo("VISA");
        assertThat(method.get("nickname").asText()).isEqualTo("Phone wallet");
        assertThat(method.get("isDefault").asBoolean()).isTrue();
        assertThat(method.get("label").asText()).isEqualTo("Google Pay");
        assertThat(activeDefaultCount(user)).isEqualTo(1);

        String cardToken = cardToken("6011111111111117", "123");
        JsonNode card = add(user, cardToken, null);
        assertThat(card.get("type").asText()).isEqualTo("CARD");
        assertThat(card.get("isDefault").asBoolean()).isFalse();
        assertThat(card.get("label").asText()).isEqualTo("Discover •••• 1117");
        assertThat(activeDefaultCount(user)).isEqualTo(1);
    }

    @Test
    void duplicateMetadataIsRejectedWithoutAddingOrChangingDefault() throws Exception {
        mvc.perform(post("/api/payment-methods").header("X-Demo-User", RIDER1)
                        .contentType("application/json")
                        .content("{\"token\":\"tok_seed_rider1_visa\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("DUPLICATE_PAYMENT_METHOD"));
        assertThat(activeMethodCount(UUID.fromString(RIDER1))).isEqualTo(2);
        assertThat(activeDefaultCount(UUID.fromString(RIDER1))).isEqualTo(1);
    }

    @Test
    void patchUpdatesNicknameClearsItAndChangesDefaultAtomically() throws Exception {
        mvc.perform(patch("/api/payment-methods/{id}", RIDER1_APPLE)
                        .header("X-Demo-User", RIDER1).contentType("application/json")
                        .content("{\"nickname\":\" Campus wallet \",\"isDefault\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value("Campus wallet"))
                .andExpect(jsonPath("$.isDefault").value(true));
        assertThat(defaultId(UUID.fromString(RIDER1))).isEqualTo(UUID.fromString(RIDER1_APPLE));
        assertThat(activeDefaultCount(UUID.fromString(RIDER1))).isEqualTo(1);

        mvc.perform(patch("/api/payment-methods/{id}", RIDER1_APPLE)
                        .header("X-Demo-User", RIDER1).contentType("application/json")
                        .content("{\"nickname\":null,\"isDefault\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").isEmpty())
                .andExpect(jsonPath("$.isDefault").value(true));
        assertThat(activeDefaultCount(UUID.fromString(RIDER1))).isEqualTo(1);
    }

    @Test
    void deletingDefaultSoftDeletesAndPromotesNewestRemaining() throws Exception {
        mvc.perform(delete("/api/payment-methods/{id}", RIDER1_VISA).header("X-Demo-User", RIDER1))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(jdbc.queryForObject("SELECT deleted_at IS NOT NULL FROM payment_methods WHERE id = ?",
                Boolean.class, UUID.fromString(RIDER1_VISA))).isTrue();
        assertThat(defaultId(UUID.fromString(RIDER1))).isEqualTo(UUID.fromString(RIDER1_APPLE));
        assertThat(activeDefaultCount(UUID.fromString(RIDER1))).isEqualTo(1);
        mvc.perform(get("/api/payment-methods").header("X-Demo-User", RIDER1))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(RIDER1_APPLE));
        mvc.perform(delete("/api/payment-methods/{id}", RIDER1_VISA).header("X-Demo-User", RIDER1))
                .andExpect(status().isNotFound());
    }

    @Test
    void activeAuthorizationBlocksDeleteButTerminalPaymentDoesNot() throws Exception {
        UUID rideId = UUID.randomUUID();
        insertRide(rideId);
        UUID paymentId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO ride_payments
                    (id, ride_id, user_id, payment_method_id, amount_total, credits_applied,
                     card_amount, status, authorized_at)
                VALUES (?, ?, ?::uuid, ?::uuid, 6.50, 0, 6.50, 'AUTHORIZED', now())
                """, paymentId, rideId, RIDER1, RIDER1_VISA);
        mvc.perform(delete("/api/payment-methods/{id}", RIDER1_VISA).header("X-Demo-User", RIDER1))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("PAYMENT_METHOD_IN_USE"));
        assertThat(activeMethodCount(UUID.fromString(RIDER1))).isEqualTo(2);

        jdbc.update("UPDATE ride_payments SET status = 'CAPTURED', captured_at = now() WHERE id = ?", paymentId);
        mvc.perform(delete("/api/payment-methods/{id}", RIDER1_VISA).header("X-Demo-User", RIDER1))
                .andExpect(status().isNoContent());
    }

    @Test
    void ownershipMissingTokenAndValidationUseContractErrors() throws Exception {
        mvc.perform(patch("/api/payment-methods/{id}", RIDER1_VISA)
                        .header("X-Demo-User", RIDER2).contentType("application/json")
                        .content("{\"isDefault\":true}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("NOT_FOUND"));
        mvc.perform(delete("/api/payment-methods/{id}", RIDER1_VISA).header("X-Demo-User", RIDER2))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/payment-methods").header("X-Demo-User", RIDER1)
                        .contentType("application/json").content("{\"token\":\"tok_missing\"}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("NOT_FOUND"));
        mvc.perform(post("/api/payment-methods").header("X-Demo-User", RIDER1)
                        .contentType("application/json").content("{\"token\":\"\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        mvc.perform(patch("/api/payment-methods/{id}", RIDER1_VISA)
                        .header("X-Demo-User", RIDER1).contentType("application/json")
                        .content(mapper.writeValueAsString(Map.of("nickname", "x".repeat(51)))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    private UUID insertUser() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email, name, mode) VALUES (?, ?, 'Payment Tester', 'RIDER')",
                id, id + "@scarletmail.rutgers.edu");
        return id;
    }

    private JsonNode add(UUID user, String token, String nickname) throws Exception {
        String body = nickname == null
                ? mapper.writeValueAsString(Map.of("token", token))
                : mapper.writeValueAsString(Map.of("token", token, "nickname", nickname));
        String response = mvc.perform(post("/api/payment-methods").header("X-Demo-User", user.toString())
                        .contentType("application/json").content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(response);
    }

    private String walletToken(String type) throws Exception {
        String response = mvc.perform(post("/mockpay/v1/wallet-tokens").contentType("application/json")
                        .content(mapper.writeValueAsString(Map.of("walletType", type))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(response).get("token").asText();
    }

    private String cardToken(String number, String cvc) throws Exception {
        String response = mvc.perform(post("/mockpay/v1/tokens").contentType("application/json")
                        .content(mapper.writeValueAsString(Map.of("number", number, "expMonth", 12,
                                "expYear", 2099, "cvc", cvc))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(response).get("token").asText();
    }

    private void insertRide(UUID rideId) {
        jdbc.update("""
                INSERT INTO rides
                    (id, rider_id, pickup_hub_id, dropoff_hub_id, status, fare_total, platform_fee,
                     base_fare, driver_payout, platform_margin, share_token)
                VALUES (?, ?::uuid, '00000000-0000-0000-0000-000000000301',
                        '00000000-0000-0000-0000-000000000302', 'REQUESTED',
                        6.50, 1.50, 5.00, 4.50, 2.00, ?)
                """, rideId, RIDER1, "share-" + rideId);
    }

    private int activeMethodCount(UUID userId) {
        return jdbc.queryForObject("""
                SELECT count(*) FROM payment_methods WHERE user_id = ? AND deleted_at IS NULL
                """, Integer.class, userId);
    }

    private int activeDefaultCount(UUID userId) {
        return jdbc.queryForObject("""
                SELECT count(*) FROM payment_methods
                WHERE user_id = ? AND deleted_at IS NULL AND is_default
                """, Integer.class, userId);
    }

    private UUID defaultId(UUID userId) {
        return jdbc.queryForObject("""
                SELECT id FROM payment_methods
                WHERE user_id = ? AND deleted_at IS NULL AND is_default
                """, UUID.class, userId);
    }
}
