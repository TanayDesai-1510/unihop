package com.unihop.ride;

import com.unihop.common.enums.DeclineCode;
import com.unihop.payments.PaymentDeclinedException;
import com.unihop.payments.PaymentMethodRequiredException;
import com.unihop.payments.PaymentService;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.UUID;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Not @Transactional on purpose: the 402 must roll back the real ride-creation transaction, which a test-managed
 * transaction would hide.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class RidePaymentRollbackTest {

    static final UUID RIDER2 = UUID.fromString("00000000-0000-0000-0000-000000000102");
    static final String OLD_CARD = "00000000-0000-0000-0000-000000000404";
    static final String YARD = "00000000-0000-0000-0000-000000000301";
    static final String BUSCH_SC = "00000000-0000-0000-0000-000000000302";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @MockitoBean
    PaymentService paymentService;

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM rides WHERE rider_id = ?", RIDER2);
    }

    @Test
    void declinedCardIs402WithDeclineCodeAndNoRide() throws Exception {
        when(paymentService.authorizeRide(any(), eq(RIDER2), any(), anyBoolean(), any()))
                .thenThrow(new PaymentDeclinedException(DeclineCode.CARD_DECLINED));

        mvc.perform(post("/api/rides").header("X-Demo-User", RIDER2.toString()).contentType("application/json")
                        .content("{\"pickupHubId\":\"" + YARD + "\",\"dropoffHubId\":\"" + BUSCH_SC
                                + "\",\"paymentMethodId\":\"" + OLD_CARD + "\",\"useCredits\":true}"))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.error").value("PAYMENT_DECLINED"))
                .andExpect(jsonPath("$.declineCode").value("CARD_DECLINED"));

        verify(paymentService).authorizeRide(any(), eq(RIDER2), eq(UUID.fromString(OLD_CARD)), eq(true),
                eq(new BigDecimal("6.50")));
        assertThat(rideCount()).isZero();
    }

    @Test
    void missingPaymentMethodIs402AndNoRide() throws Exception {
        when(paymentService.authorizeRide(any(), eq(RIDER2), any(), anyBoolean(), any()))
                .thenThrow(new PaymentMethodRequiredException());

        mvc.perform(post("/api/rides").header("X-Demo-User", RIDER2.toString()).contentType("application/json")
                        .content("{\"pickupHubId\":\"" + YARD + "\",\"dropoffHubId\":\"" + BUSCH_SC + "\"}"))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.error").value("PAYMENT_METHOD_REQUIRED"));

        verify(paymentService).authorizeRide(any(), eq(RIDER2), eq(null), eq(false), eq(new BigDecimal("6.50")));
        assertThat(rideCount()).isZero();
    }

    private int rideCount() {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM rides WHERE rider_id = ?", Integer.class, RIDER2);
        return n == null ? 0 : n;
    }
}
