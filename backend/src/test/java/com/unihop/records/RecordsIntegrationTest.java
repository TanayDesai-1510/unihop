package com.unihop.records;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@Transactional
class RecordsIntegrationTest {
    private static final UUID RIDER1 = UUID.fromString("00000000-0000-0000-0000-000000000101");
    private static final UUID RIDER2 = UUID.fromString("00000000-0000-0000-0000-000000000102");
    private static final UUID DRIVER1 = UUID.fromString("00000000-0000-0000-0000-000000000201");
    private static final UUID DRIVER2 = UUID.fromString("00000000-0000-0000-0000-000000000202");
    private static final UUID RIDER1_CARD = UUID.fromString("00000000-0000-0000-0000-000000000401");

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @Test
    void historyFiltersByModeAndReturnsNewestFirst() throws Exception {
        UUID riderOlder = insertRide(RIDER1, DRIVER1, "COMPLETED", "3 hours");
        UUID riderNewer = insertRide(RIDER1, DRIVER2, "CANCELLED", "2 hours");
        UUID driverNewer = insertRide(RIDER2, DRIVER1, "COMPLETED", "1 hour");

        mvc.perform(get("/api/me/rides?mode=RIDER").header("X-Demo-User", RIDER1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(riderNewer.toString()))
                .andExpect(jsonPath("$[0].status").value("CANCELLED"))
                .andExpect(jsonPath("$[0].pickupHubName").value("The Yard"))
                .andExpect(jsonPath("$[0].dropoffHubName").value("Busch Student Center"))
                .andExpect(jsonPath("$[0].total").value(6.50))
                .andExpect(jsonPath("$[0].driverPayout").value(4.50))
                .andExpect(jsonPath("$[0].completedAt").value(nullValue()))
                .andExpect(jsonPath("$[0].requestedAt").isNotEmpty())
                .andExpect(jsonPath("$[1].id").value(riderOlder.toString()));

        mvc.perform(get("/api/me/rides?mode=DRIVER").header("X-Demo-User", DRIVER1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(driverNewer.toString()))
                .andExpect(jsonPath("$[1].id").value(riderOlder.toString()));
    }

    @Test
    void historyRequiresModeAndAuthentication() throws Exception {
        mvc.perform(get("/api/me/rides").header("X-Demo-User", RIDER1))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        mvc.perform(get("/api/me/rides?mode=PASSENGER").header("X-Demo-User", RIDER1))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
        mvc.perform(get("/api/me/rides?mode=RIDER"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void completedRideReceiptContainsContractFieldsAndSplitPaymentLabel() throws Exception {
        Instant requestedAt = Instant.parse("2026-10-11T10:00:00Z");
        Instant startedAt = Instant.parse("2026-10-11T10:15:00Z");
        Instant completedAt = Instant.parse("2026-10-11T10:35:30Z");
        UUID ride = insertCompletedRideWithPayment(requestedAt, startedAt, completedAt, "5.00", "1.50");

        mvc.perform(get("/api/rides/" + ride + "/receipt").header("X-Demo-User", RIDER1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rideId").value(ride.toString()))
                .andExpect(jsonPath("$.pickupHubName").value("The Yard"))
                .andExpect(jsonPath("$.dropoffHubName").value("Busch Student Center"))
                .andExpect(jsonPath("$.fare.total").value(6.50))
                .andExpect(jsonPath("$.fare.platformFee").value(1.50))
                .andExpect(jsonPath("$.fare.baseFare").value(5.00))
                .andExpect(jsonPath("$.fare.driverPayout").value(4.50))
                .andExpect(jsonPath("$.fare.platformMargin").value(2.00))
                .andExpect(jsonPath("$.payment.status").value("CAPTURED"))
                .andExpect(jsonPath("$.payment.methodLabel").value("UniHop Cash + Visa •••• 4242"))
                .andExpect(jsonPath("$.payment.creditsApplied").value(5.00))
                .andExpect(jsonPath("$.payment.cardAmount").value(1.50))
                .andExpect(jsonPath("$.payment.amountTotal").value(6.50))
                .andExpect(jsonPath("$.payment.declineCode").value(nullValue()))
                .andExpect(jsonPath("$.driverName").value("Alex Kim"))
                .andExpect(jsonPath("$.riderName").value("Jordan Patel"))
                .andExpect(jsonPath("$.startedAt").value("2026-10-11T10:15:00Z"))
                .andExpect(jsonPath("$.completedAt").value("2026-10-11T10:35:30Z"))
                .andExpect(jsonPath("$.durationSeconds").value(1230));

        mvc.perform(get("/api/rides/" + ride + "/receipt").header("X-Demo-User", DRIVER1))
                .andExpect(status().isOk());
    }

    @Test
    void receiptIsParticipantOnlyAndCompletedOnly() throws Exception {
        UUID completed = insertCompletedRideWithPayment(
                Instant.parse("2026-10-11T10:00:00Z"),
                Instant.parse("2026-10-11T10:15:00Z"),
                Instant.parse("2026-10-11T10:35:30Z"), "0.00", "6.50");
        UUID active = insertRide(RIDER1, DRIVER1, "IN_PROGRESS", "1 hour");
        insertPayment(active, "AUTHORIZED", "0.00", "6.50");

        mvc.perform(get("/api/rides/" + completed + "/receipt").header("X-Demo-User", RIDER2))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("FORBIDDEN"));
        mvc.perform(get("/api/rides/" + active + "/receipt").header("X-Demo-User", RIDER1))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("NOT_FOUND"));
        mvc.perform(get("/api/rides/" + UUID.randomUUID() + "/receipt").header("X-Demo-User", RIDER1))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("NOT_FOUND"));
    }

    private UUID insertRide(UUID riderId, UUID driverId, String status, String age) {
        UUID ride = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO rides
                    (id, rider_id, driver_id, pickup_hub_id, dropoff_hub_id, status, fare_total,
                     platform_fee, base_fare, driver_payout, platform_margin, share_token,
                     requested_at, started_at, completed_at)
                VALUES (?, ?, ?,
                        '00000000-0000-0000-0000-000000000301',
                        '00000000-0000-0000-0000-000000000302', ?,
                        6.50, 1.50, 5.00, 4.50, 2.00, ?, now() - ?::interval,
                        CASE WHEN ? IN ('IN_PROGRESS', 'COMPLETED') THEN now() - interval '30 minutes' ELSE NULL END,
                        CASE WHEN ? = 'COMPLETED' THEN now() ELSE NULL END)
                """, ride, riderId, driverId, status, "share-" + ride, age, status, status);
        return ride;
    }

    private UUID insertCompletedRideWithPayment(Instant requestedAt, Instant startedAt, Instant completedAt,
                                                String credits, String card) {
        UUID ride = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO rides
                    (id, rider_id, driver_id, pickup_hub_id, dropoff_hub_id, status, fare_total,
                     platform_fee, base_fare, driver_payout, platform_margin, share_token,
                     requested_at, started_at, completed_at)
                VALUES (?, ?, ?,
                        '00000000-0000-0000-0000-000000000301',
                        '00000000-0000-0000-0000-000000000302', 'COMPLETED',
                        6.50, 1.50, 5.00, 4.50, 2.00, ?, ?, ?, ?)
                """, ride, RIDER1, DRIVER1, "share-" + ride,
                Timestamp.from(requestedAt), Timestamp.from(startedAt), Timestamp.from(completedAt));
        insertPayment(ride, "CAPTURED", credits, card);
        return ride;
    }

    private void insertPayment(UUID ride, String status, String credits, String card) {
        jdbc.update("""
                INSERT INTO ride_payments
                    (id, ride_id, user_id, payment_method_id, amount_total, credits_applied,
                     card_amount, status, authorized_at, captured_at)
                VALUES (?, ?, ?, ?, 6.50, ?::numeric, ?::numeric, ?, now(),
                        CASE WHEN ? = 'CAPTURED' THEN now() ELSE NULL END)
                """, UUID.randomUUID(), ride, RIDER1, RIDER1_CARD, credits, card, status, status);
    }
}
