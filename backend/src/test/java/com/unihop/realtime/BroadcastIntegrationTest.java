package com.unihop.realtime;

import com.jayway.jsonpath.JsonPath;
import com.unihop.common.enums.RideStatus;
import com.unihop.ride.RideTestData;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Not @Transactional: events are sent after commit. Drives real rides over HTTP and captures what the publisher sends.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class BroadcastIntegrationTest {

    static final UUID RIDER1 = UUID.fromString("00000000-0000-0000-0000-000000000101");
    static final UUID DRIVER1 = UUID.fromString("00000000-0000-0000-0000-000000000201");
    static final UUID DRIVER2 = UUID.fromString("00000000-0000-0000-0000-000000000202");
    static final String YARD = "00000000-0000-0000-0000-000000000301";
    static final String BUSCH_SC = "00000000-0000-0000-0000-000000000302";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

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
    void everyStepOfAFullRidePublishesItsStatusWithDriverAndEta() throws Exception {
        UUID ride = requestRide();
        post(DRIVER1, "/api/rides/" + ride + "/accept", null).andExpect(status().isOk());
        post(DRIVER1, "/api/rides/" + ride + "/arrived", null).andExpect(status().isOk());
        String pin = jdbc.queryForObject("SELECT pin FROM rides WHERE id = ?", String.class, ride);
        post(DRIVER1, "/api/rides/" + ride + "/start", "{\"pin\":\"" + pin + "\"}").andExpect(status().isOk());
        post(DRIVER1, "/api/rides/" + ride + "/complete", null).andExpect(status().isOk());

        List<RideStatusEvent> events = statusEvents();
        assertThat(events).extracting(RideStatusEvent::status).containsExactly(
                RideStatus.ACCEPTED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS, RideStatus.COMPLETED);
        assertThat(events).allSatisfy(e -> {
            assertThat(e.rideId()).isEqualTo(ride);
            assertThat(e.driver().id()).isEqualTo(DRIVER1);
            assertThat(e.driver().plate()).isEqualTo("R23-HKP");
            assertThat(e.updatedAt()).isNotNull();
        });
        // driver1 is ~95 m from The Yard; Busch is ~2.7 km away
        assertThat(events.get(0).etaSeconds()).isBetween(5, 30);
        assertThat(events.get(1).etaSeconds()).isNull();
        assertThat(events.get(2).etaSeconds()).isBetween(400, 500);
        assertThat(events.get(3).etaSeconds()).isNull();
    }

    @Test
    void cancelAndNoDriversArePublishedWithoutADriver() throws Exception {
        UUID cancelled = requestRide();
        post(RIDER1, "/api/rides/" + cancelled + "/cancel", "{\"reason\":\"x\"}").andExpect(status().isOk());
        RideStatusEvent cancel = statusEvents().get(0);
        assertThat(cancel.rideId()).isEqualTo(cancelled);
        assertThat(cancel.status()).isEqualTo(RideStatus.CANCELLED);
        assertThat(cancel.driver()).isNull();
        assertThat(cancel.etaSeconds()).isNull();

        clearInvocations(publisher);
        jdbc.update("UPDATE driver_profiles SET is_online = false");
        UUID none = requestRide();
        RideStatusEvent noDrivers = statusEvents().get(0);
        assertThat(noDrivers.rideId()).isEqualTo(none);
        assertThat(noDrivers.status()).isEqualTo(RideStatus.NO_DRIVERS);
    }

    @Test
    void rejectedStepsPublishNothing() throws Exception {
        UUID ride = requestRide();
        post(DRIVER1, "/api/rides/" + ride + "/accept", null).andExpect(status().isOk());
        post(DRIVER1, "/api/rides/" + ride + "/arrived", null).andExpect(status().isOk());
        clearInvocations(publisher);

        post(DRIVER1, "/api/rides/" + ride + "/start", "{\"pin\":\"nope\"}").andExpect(status().isBadRequest());
        post(DRIVER1, "/api/rides/" + ride + "/complete", null).andExpect(status().isConflict());
        post(DRIVER2, "/api/rides/" + ride + "/cancel", "{}").andExpect(status().isForbidden());
        verify(publisher, never()).rideStatus(any());
    }

    @Test
    void driverLocationIsPushedWhileAcceptedOrInProgressOnly() throws Exception {
        UUID ride = requestRide();
        post(DRIVER1, "/api/rides/" + ride + "/accept", null).andExpect(status().isOk());

        // driver1 starts at 40.5004,-74.4471 and moves due north
        location(DRIVER1, 40.5014, -74.4471);
        ArgumentCaptor<RideLocationEvent> captor = ArgumentCaptor.forClass(RideLocationEvent.class);
        verify(publisher).rideLocation(eq(ride), captor.capture());
        RideLocationEvent toPickup = captor.getValue();
        assertThat(toPickup.lat()).isEqualTo(40.5014);
        assertThat(toPickup.lng()).isEqualTo(-74.4471);
        assertThat(toPickup.heading()).isCloseTo(0, within(1.0));
        assertThat(toPickup.etaSeconds()).isPositive();

        // a driver with no ride: nothing
        location(DRIVER2, 40.523, -74.458);
        verify(publisher, times(1)).rideLocation(any(), any());

        post(DRIVER1, "/api/rides/" + ride + "/arrived", null).andExpect(status().isOk());
        clearInvocations(publisher);
        location(DRIVER1, 40.4998, -74.4479);
        verify(publisher, never()).rideLocation(any(), any());

        String pin = jdbc.queryForObject("SELECT pin FROM rides WHERE id = ?", String.class, ride);
        post(DRIVER1, "/api/rides/" + ride + "/start", "{\"pin\":\"" + pin + "\"}").andExpect(status().isOk());
        // same point twice: heading falls back to the bearing toward the dropoff (Busch is north-west)
        location(DRIVER1, 40.4998, -74.4479);
        verify(publisher).rideLocation(eq(ride), captor.capture());
        RideLocationEvent toDropoff = captor.getValue();
        assertThat(toDropoff.heading()).isBetween(270.0, 360.0);
        assertThat(toDropoff.etaSeconds()).isBetween(400, 500);
    }

    private List<RideStatusEvent> statusEvents() {
        ArgumentCaptor<RideStatusEvent> captor = ArgumentCaptor.forClass(RideStatusEvent.class);
        verify(publisher, atLeastOnce()).rideStatus(captor.capture());
        return captor.getAllValues();
    }

    private UUID requestRide() throws Exception {
        String body = post(RIDER1, "/api/rides", "{\"pickupHubId\":\"" + YARD + "\",\"dropoffHubId\":\"" + BUSCH_SC + "\"}")
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return UUID.fromString(JsonPath.read(body, "$.id"));
    }

    private void location(UUID driver, double lat, double lng) throws Exception {
        post(driver, "/api/drivers/me/location", "{\"lat\":" + lat + ",\"lng\":" + lng + "}")
                .andExpect(status().isNoContent());
    }

    private ResultActions post(UUID user, String path, String body) throws Exception {
        var request = org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(path)
                .header("X-Demo-User", user.toString());
        if (body != null) {
            request = request.contentType("application/json").content(body);
        }
        return mvc.perform(request);
    }
}
