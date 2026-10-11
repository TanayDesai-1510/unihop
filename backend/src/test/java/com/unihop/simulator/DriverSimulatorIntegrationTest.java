package com.unihop.simulator;

import com.jayway.jsonpath.JsonPath;
import com.unihop.common.enums.RideStatus;
import com.unihop.payments.PaymentService;
import com.unihop.realtime.RealtimePublisher;
import com.unihop.realtime.RideStatusEvent;
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
import org.springframework.messaging.simp.user.SimpUser;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Simulator on, with no delays and a tick so long it never fires on its own: the test calls {@code tick()} itself.
 * Not @Transactional: everything runs through real, committed transactions. Cleans up after each test.
 */
@SpringBootTest(properties = {
        "app.simulator.enabled=true",
        "app.simulator.tick-ms=3600000",
        "app.simulator.accept-delay-ms=0",
        "app.simulator.start-delay-ms=0"})
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class DriverSimulatorIntegrationTest {

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
    DriverSimulator simulator;

    @MockitoSpyBean
    RealtimePublisher publisher;

    @MockitoSpyBean
    PaymentService paymentService;

    @MockitoSpyBean
    SimpUserRegistry wsUsers;

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
    void seededDriverAcceptsDrivesStartsWithPinAndCompletes() throws Exception {
        UUID ride = requestRide();

        int ticks = 0;
        while (!"COMPLETED".equals(statusOf(ride)) && ticks < 100) {
            simulator.tick();
            ticks++;
        }
        assertThat(statusOf(ride)).isEqualTo("COMPLETED");

        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM rides WHERE id = ?", ride);
        assertThat(row.get("driver_id")).isEqualTo(DRIVER1);
        assertThat(row.get("arrived_at")).isNotNull();
        assertThat(row.get("started_at")).isNotNull();
        verify(paymentService).captureRide(ride);

        ArgumentCaptor<RideStatusEvent> statuses = ArgumentCaptor.forClass(RideStatusEvent.class);
        verify(publisher, atLeast(4)).rideStatus(statuses.capture());
        assertThat(statuses.getAllValues()).extracting(RideStatusEvent::status).containsExactly(
                RideStatus.ACCEPTED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS, RideStatus.COMPLETED);
        // location was published on the way to pickup and on the way to Busch
        verify(publisher, atLeast(5)).rideLocation(eq(ride), any());

        // the driver ends up parked at the dropoff hub
        Map<String, Object> driver = jdbc.queryForMap(
                "SELECT current_lat, current_lng FROM driver_profiles WHERE user_id = ?", DRIVER1);
        assertThat(driver.get("current_lat")).isEqualTo(40.5232);
        assertThat(driver.get("current_lng")).isEqualTo(-74.4585);
    }

    @Test
    void driverWithALiveWebSocketSessionIsNeverAutoDriven() throws Exception {
        doReturn(mock(SimpUser.class)).when(wsUsers).getUser(DRIVER1.toString());
        UUID ride = requestRide();

        simulator.tick();
        simulator.tick();
        assertThat(statusOf(ride)).isEqualTo("REQUESTED");
        assertThat(jdbc.queryForObject("SELECT status FROM ride_offers WHERE ride_id = ? AND driver_id = ?",
                String.class, ride, DRIVER1)).isEqualTo("OFFERED");

        // the real driver accepts by hand; the simulator still leaves the ride alone
        mvc.perform(post("/api/rides/" + ride + "/accept").header("X-Demo-User", DRIVER1.toString()))
                .andExpect(status().isOk());
        simulator.tick();
        simulator.tick();
        assertThat(statusOf(ride)).isEqualTo("ACCEPTED");
        verify(publisher, never()).rideLocation(any(), any());
    }

    @Test
    void nonSeededDriversAreNeverSimulated() {
        assertThat(simulator.isSimulated(DRIVER5)).isTrue();
        assertThat(simulator.isSimulated(RIDER1)).isFalse();
        assertThat(simulator.isSimulated(UUID.randomUUID())).isFalse();
    }

    private String statusOf(UUID ride) {
        return jdbc.queryForObject("SELECT status FROM rides WHERE id = ?", String.class, ride);
    }

    private UUID requestRide() throws Exception {
        String body = mvc.perform(post("/api/rides").header("X-Demo-User", RIDER1.toString())
                        .contentType("application/json")
                        .content("{\"pickupHubId\":\"" + YARD + "\",\"dropoffHubId\":\"" + BUSCH_SC + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(JsonPath.read(body, "$.id"));
    }
}
