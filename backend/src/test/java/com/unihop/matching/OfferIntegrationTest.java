package com.unihop.matching;

import com.jayway.jsonpath.JsonPath;
import com.unihop.realtime.RealtimePublisher;
import com.unihop.ride.RideTestData;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Not @Transactional: offers are created after the ride-creation commit. Cleans up after each test. */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class OfferIntegrationTest {

    static final UUID RIDER1 = UUID.fromString("00000000-0000-0000-0000-000000000101");
    static final UUID DRIVER1 = UUID.fromString("00000000-0000-0000-0000-000000000201");
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

    List<Map<String, Object>> seededDrivers;

    @BeforeEach
    void snapshotDrivers() {
        seededDrivers = jdbc.queryForList("SELECT user_id, is_online, current_lat, current_lng FROM driver_profiles");
    }

    @AfterEach
    void cleanUp() {
        RideTestData.deleteAllRides(jdbc);
        for (Map<String, Object> d : seededDrivers) {
            jdbc.update("UPDATE driver_profiles SET is_online = ?, current_lat = ?, current_lng = ? WHERE user_id = ?",
                    d.get("is_online"), d.get("current_lat"), d.get("current_lng"), d.get("user_id"));
        }
    }

    @Test
    void holderAcceptsAndGetsTheRideWithoutPinWhileRiderSeesPin() throws Exception {
        UUID rideId = requestRide();
        UUID offerId = liveOfferId(rideId, DRIVER1);

        as(DRIVER1, "/api/rides/" + rideId + "/accept")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(rideId.toString()))
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.driver.id").value(DRIVER1.toString()))
                .andExpect(jsonPath("$.driver.plate").value("R23-HKP"))
                .andExpect(jsonPath("$.acceptedAt").isString())
                .andExpect(jsonPath("$.pin").value(nullValue()));

        String pin = jdbc.queryForObject("SELECT pin FROM rides WHERE id = ?", String.class, rideId);
        assertThat(pin).matches("\\d{4}");
        mvc.perform(get("/api/rides/" + rideId).header("X-Demo-User", RIDER1.toString()))
                .andExpect(jsonPath("$.pin").value(pin))
                .andExpect(jsonPath("$.driver.name").value("Alex Kim"));

        Map<String, Object> offer = jdbc.queryForMap("SELECT * FROM ride_offers WHERE id = ?", offerId);
        assertThat(offer.get("status")).isEqualTo("ACCEPTED");
        assertThat(offer.get("responded_at")).isNotNull();

        // answered: a second accept or a decline is no longer possible, and no offer is pending
        as(DRIVER1, "/api/rides/" + rideId + "/accept")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("OFFER_NOT_ACTIVE"));
        as(DRIVER1, "/api/rides/" + rideId + "/decline")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("OFFER_NOT_ACTIVE"));
        mvc.perform(get("/api/drivers/me/offer").header("X-Demo-User", DRIVER1.toString()))
                .andExpect(status().isNoContent());
    }

    @Test
    void nonHolderIs403AndUnknownRideIs404() throws Exception {
        UUID rideId = requestRide();
        as(DRIVER5, "/api/rides/" + rideId + "/accept")
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("FORBIDDEN"));
        as(RIDER1, "/api/rides/" + rideId + "/accept").andExpect(status().isForbidden());
        as(DRIVER5, "/api/rides/" + rideId + "/decline").andExpect(status().isForbidden());
        as(DRIVER1, "/api/rides/" + UUID.randomUUID() + "/accept")
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("NOT_FOUND"));
        assertThat(jdbc.queryForObject("SELECT status FROM rides WHERE id = ?", String.class, rideId))
                .isEqualTo("REQUESTED");
    }

    @Test
    void expiredOfferIs409EvenBeforeTheSweeperRuns() throws Exception {
        UUID rideId = requestRide();
        liveOfferId(rideId, DRIVER1);
        jdbc.update("UPDATE ride_offers SET expires_at = now() - interval '1 second' WHERE ride_id = ?", rideId);

        as(DRIVER1, "/api/rides/" + rideId + "/accept")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("OFFER_NOT_ACTIVE"));
        assertThat(jdbc.queryForObject("SELECT driver_id FROM rides WHERE id = ?", UUID.class, rideId)).isNull();
    }

    @Test
    void revokedOfferIs409() throws Exception {
        UUID rideId = requestRide();
        liveOfferId(rideId, DRIVER1);
        tx.executeWithoutResult(s -> matching.revokeLiveOffer(rideId));

        as(DRIVER1, "/api/rides/" + rideId + "/accept")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("OFFER_NOT_ACTIVE"));
    }

    @Test
    void declineMovesTheRideToTheNextDriver() throws Exception {
        UUID rideId = requestRide();
        UUID first = liveOfferId(rideId, DRIVER1);

        as(DRIVER1, "/api/rides/" + rideId + "/decline")
                .andExpect(status().isNoContent()).andExpect(content().string(""));

        assertThat(jdbc.queryForObject("SELECT status FROM ride_offers WHERE id = ?", String.class, first))
                .isEqualTo("DECLINED");
        UUID next = liveOfferId(rideId, DRIVER5);
        verify(publisher).offer(eq(DRIVER5), argThat(o -> o.offerId().equals(next) && o.rideId().equals(rideId)));

        // driver1 declined: cannot change their mind, and is never re-offered
        as(DRIVER1, "/api/rides/" + rideId + "/accept")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("OFFER_NOT_ACTIVE"));
        as(DRIVER5, "/api/rides/" + rideId + "/accept").andExpect(status().isOk())
                .andExpect(jsonPath("$.driver.id").value(DRIVER5.toString()));
    }

    @Test
    void currentOfferRecoversTheLiveOfferOr204() throws Exception {
        UUID rideId = requestRide();
        UUID offerId = liveOfferId(rideId, DRIVER1);

        mvc.perform(get("/api/drivers/me/offer").header("X-Demo-User", DRIVER1.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.offerId").value(offerId.toString()))
                .andExpect(jsonPath("$.rideId").value(rideId.toString()))
                .andExpect(jsonPath("$.pickupHub.code").value("YARD"))
                .andExpect(jsonPath("$.dropoffHub.code").value("BUSCH_SC"))
                .andExpect(jsonPath("$.fare.total").value(6.5))
                .andExpect(jsonPath("$.riderName").value("Jordan Patel"))
                .andExpect(jsonPath("$.riderRating").isNumber())
                .andExpect(jsonPath("$.distanceToPickupMeters").value(org.hamcrest.Matchers.allOf(
                        org.hamcrest.Matchers.greaterThan(50), org.hamcrest.Matchers.lessThan(150))))
                .andExpect(jsonPath("$.expiresAt").isString());
        mvc.perform(get("/api/drivers/me/offer").header("X-Demo-User", DRIVER5.toString()))
                .andExpect(status().isNoContent());

        jdbc.update("UPDATE ride_offers SET expires_at = now() - interval '1 second' WHERE id = ?", offerId);
        mvc.perform(get("/api/drivers/me/offer").header("X-Demo-User", DRIVER1.toString()))
                .andExpect(status().isNoContent());
    }

    @Test
    void pinsAreFourDigits() {
        for (int i = 0; i < 1000; i++) {
            assertThat(OfferService.newPin()).matches("\\d{4}");
        }
    }

    private UUID requestRide() throws Exception {
        String body = mvc.perform(post("/api/rides").header("X-Demo-User", RIDER1.toString())
                        .contentType("application/json")
                        .content("{\"pickupHubId\":\"" + YARD + "\",\"dropoffHubId\":\"" + BUSCH_SC + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(JsonPath.read(body, "$.id"));
    }

    private UUID liveOfferId(UUID rideId, UUID driverId) {
        return jdbc.queryForObject("SELECT id FROM ride_offers WHERE ride_id = ? AND driver_id = ? AND status = 'OFFERED'",
                UUID.class, rideId, driverId);
    }

    private ResultActions as(UUID user, String path) throws Exception {
        return mvc.perform(post(path).header("X-Demo-User", user.toString()));
    }
}
