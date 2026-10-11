package com.unihop.matching;

import com.jayway.jsonpath.JsonPath;
import com.unihop.payments.PaymentService;
import com.unihop.realtime.RealtimePublisher;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Not @Transactional: matching runs after the ride-creation commit, which a test transaction would never reach.
 * Each test cleans up its rides/offers and restores the seeded driver locations.
 * <p>
 * Seeded drivers by distance from The Yard: driver1 (~95 m), driver5 (~310 m), driver4 (Cook), driver2 (Busch),
 * driver3 (Livingston).
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class MatchingIntegrationTest {

    static final UUID RIDER1 = UUID.fromString("00000000-0000-0000-0000-000000000101");
    static final UUID RIDER2 = UUID.fromString("00000000-0000-0000-0000-000000000102");
    static final UUID DRIVER1 = UUID.fromString("00000000-0000-0000-0000-000000000201");
    static final UUID DRIVER2 = UUID.fromString("00000000-0000-0000-0000-000000000202");
    static final UUID DRIVER3 = UUID.fromString("00000000-0000-0000-0000-000000000203");
    static final UUID DRIVER4 = UUID.fromString("00000000-0000-0000-0000-000000000204");
    static final UUID DRIVER5 = UUID.fromString("00000000-0000-0000-0000-000000000205");
    static final String YARD = "00000000-0000-0000-0000-000000000301";
    static final String BUSCH_SC = "00000000-0000-0000-0000-000000000302";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    MatchingService matching;

    @Autowired
    TransactionTemplate tx;

    @MockitoSpyBean
    RealtimePublisher publisher;

    @MockitoSpyBean
    PaymentService paymentService;

    List<Map<String, Object>> seededDrivers;

    @BeforeEach
    void snapshotDrivers() {
        seededDrivers = jdbc.queryForList("SELECT user_id, is_online, current_lat, current_lng FROM driver_profiles");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM ride_offers");
        jdbc.update("DELETE FROM ride_payments");
        jdbc.update("DELETE FROM rides");
        for (Map<String, Object> d : seededDrivers) {
            jdbc.update("UPDATE driver_profiles SET is_online = ?, current_lat = ?, current_lng = ? WHERE user_id = ?",
                    d.get("is_online"), d.get("current_lat"), d.get("current_lng"), d.get("user_id"));
        }
    }

    @Test
    void nearestDriverGetsA15SecondOfferPushedToTheirTopic() throws Exception {
        UUID rideId = requestRide(RIDER1);

        Map<String, Object> offer = liveOffer(rideId);
        assertThat(offer.get("driver_id")).isEqualTo(DRIVER1);
        Duration window = Duration.between(((java.sql.Timestamp) offer.get("offered_at")).toInstant(),
                ((java.sql.Timestamp) offer.get("expires_at")).toInstant());
        assertThat(window).isEqualTo(Duration.ofSeconds(15));

        verify(publisher).offer(eq(DRIVER1), argThat(o -> o.rideId().equals(rideId)
                && o.offerId().equals(offer.get("id"))
                && o.pickupHub().code().equals("YARD")
                && o.dropoffHub().code().equals("BUSCH_SC")
                && o.fare().total().compareTo(new java.math.BigDecimal("6.50")) == 0
                && o.riderName().equals("Jordan Patel")
                && o.distanceToPickupMeters() > 50 && o.distanceToPickupMeters() < 150));
        verify(publisher, never()).offer(eq(DRIVER5), any());
    }

    @Test
    void expiryRedispatchesInDistanceOrderWithoutRepeatsThenNoDrivers() throws Exception {
        UUID rideId = requestRide(RIDER1);
        List<UUID> expectedOrder = List.of(DRIVER1, DRIVER5, DRIVER4, DRIVER2, DRIVER3);

        for (int i = 0; i < expectedOrder.size(); i++) {
            assertThat(liveOffer(rideId).get("driver_id")).as("offer #" + (i + 1)).isEqualTo(expectedOrder.get(i));
            expireLiveOffer(rideId);
            if (i < expectedOrder.size() - 1) {
                awaitOfferCount(rideId, i + 2);
            }
        }

        verify(paymentService, timeout(3000)).voidRide(rideId);
        Map<String, Object> ride = jdbc.queryForMap("SELECT * FROM rides WHERE id = ?", rideId);
        assertThat(ride.get("status")).isEqualTo("NO_DRIVERS");
        assertThat(ride.get("cancelled_by")).isEqualTo("SYSTEM");
        assertThat(ride.get("cancelled_at")).isNotNull();

        List<UUID> offered = jdbc.queryForList(
                "SELECT driver_id FROM ride_offers WHERE ride_id = ? ORDER BY offered_at", UUID.class, rideId);
        assertThat(offered).containsExactlyElementsOf(expectedOrder);
        assertThat(jdbc.queryForList("SELECT status FROM ride_offers WHERE ride_id = ?", String.class, rideId))
                .containsOnly("EXPIRED");
    }

    @Test
    void noOnlineDriversMeansNoDriversImmediately() throws Exception {
        jdbc.update("UPDATE driver_profiles SET is_online = false");
        UUID rideId = requestRide(RIDER1);

        mvc.perform(get("/api/rides/" + rideId).header("X-Demo-User", RIDER1.toString()))
                .andExpect(jsonPath("$.status").value("NO_DRIVERS"))
                .andExpect(jsonPath("$.cancelledBy").value("SYSTEM"));
        verify(paymentService).voidRide(rideId);
        verify(publisher, never()).offer(any(), any());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM ride_offers", Integer.class)).isZero();
    }

    @Test
    void driversOnARideOrHoldingAnOfferAreSkipped() throws Exception {
        UUID first = requestRide(RIDER1);
        assertThat(liveOffer(first).get("driver_id")).isEqualTo(DRIVER1);

        // driver1 holds a live offer, so rider2's ride from the same hub goes to driver5
        UUID second = requestRide(RIDER2);
        assertThat(liveOffer(second).get("driver_id")).isEqualTo(DRIVER5);
    }

    @Test
    void driverWithActiveRideIsSkippedAndOfflineOrUnlocatedToo() throws Exception {
        // driver1 is busy on another ride, driver5 is offline, driver4 has no location
        jdbc.update("""
                INSERT INTO rides (id, rider_id, driver_id, pickup_hub_id, dropoff_hub_id, status, fare_total, platform_fee,
                                   base_fare, driver_payout, platform_margin, share_token)
                VALUES (?, ?, ?, ?::uuid, ?::uuid, 'ACCEPTED', 6.50, 1.50, 5.00, 4.50, 2.00, 'busy-token')""",
                UUID.randomUUID(), RIDER2, DRIVER1, YARD, BUSCH_SC);
        jdbc.update("UPDATE driver_profiles SET is_online = false WHERE user_id = ?", DRIVER5);
        jdbc.update("UPDATE driver_profiles SET current_lat = NULL, current_lng = NULL WHERE user_id = ?", DRIVER4);

        UUID rideId = requestRide(RIDER1);
        assertThat(liveOffer(rideId).get("driver_id")).isEqualTo(DRIVER2);
    }

    @Test
    void revokingExpiresTheLiveOfferAndNotifiesTheDriverAfterCommit() throws Exception {
        UUID rideId = requestRide(RIDER1);
        UUID offerId = (UUID) liveOffer(rideId).get("id");

        tx.executeWithoutResult(s -> {
            matching.revokeLiveOffer(rideId);
            verify(publisher, never()).offerRevoked(any(), any());
        });

        verify(publisher).offerRevoked(DRIVER1, offerId);
        Map<String, Object> offer = jdbc.queryForMap("SELECT * FROM ride_offers WHERE id = ?", offerId);
        assertThat(offer.get("status")).isEqualTo("EXPIRED");
        assertThat(offer.get("responded_at")).isNotNull();
    }

    @Test
    void revokeRolledBackSendsNothing() throws Exception {
        UUID rideId = requestRide(RIDER1);
        tx.executeWithoutResult(s -> {
            matching.revokeLiveOffer(rideId);
            s.setRollbackOnly();
        });
        verify(publisher, never()).offerRevoked(any(), any());
        assertThat(liveOffer(rideId).get("status")).isEqualTo("OFFERED");
    }

    private UUID requestRide(UUID rider) throws Exception {
        String body = mvc.perform(post("/api/rides").header("X-Demo-User", rider.toString())
                        .contentType("application/json")
                        .content("{\"pickupHubId\":\"" + YARD + "\",\"dropoffHubId\":\"" + BUSCH_SC + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(JsonPath.read(body, "$.id"));
    }

    private Map<String, Object> liveOffer(UUID rideId) {
        return jdbc.queryForMap("SELECT * FROM ride_offers WHERE ride_id = ? AND status = 'OFFERED'", rideId);
    }

    /** Backdates the live offer, then sweeps (the scheduled sweeper may get there first; either is fine). */
    private void expireLiveOffer(UUID rideId) {
        jdbc.update("""
                UPDATE ride_offers SET offered_at = offered_at - interval '20 seconds',
                                       expires_at = expires_at - interval '20 seconds'
                WHERE ride_id = ? AND status = 'OFFERED'""", rideId);
        matching.expireDueOffers();
    }

    private void awaitOfferCount(UUID rideId, int count) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 3000;
        while (System.currentTimeMillis() < deadline) {
            Integer n = jdbc.queryForObject("SELECT count(*) FROM ride_offers WHERE ride_id = ? AND status = 'OFFERED'",
                    Integer.class, rideId);
            Integer total = jdbc.queryForObject("SELECT count(*) FROM ride_offers WHERE ride_id = ?", Integer.class, rideId);
            if (n != null && n == 1 && total != null && total == count) {
                return;
            }
            Thread.sleep(20);
        }
        throw new AssertionError("ride " + rideId + " never reached " + count + " offers");
    }
}
