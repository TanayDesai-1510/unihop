package com.unihop.simulator;

import com.unihop.matching.Haversine;
import com.unihop.matching.OfferService;
import com.unihop.realtime.DriverAvailabilityService;
import com.unihop.ride.RideService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Contract section 12: seeded drivers that nobody is driving for real accept offers after 3 seconds, drive to the
 * pickup, arrive, start with the rider's PIN, drive to the dropoff and complete (which captures payment).
 * <p>
 * Stateless: every tick reads ride state from the database and goes through the same services a real driver app
 * calls, so status/location broadcasts, PIN checks and payment capture all behave exactly as for a real driver.
 * A seeded driver counts as "real" while they have a live WebSocket session (the driver app is open); real drivers
 * are never auto-driven. Simulated time is compressed: each leg takes well under a minute.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "app.simulator.enabled", havingValue = "true")
public class DriverSimulator {

    /** Seeded driver1..driver5 (contract section 7). */
    static final Set<UUID> SEEDED_DRIVERS = Set.of(
            UUID.fromString("00000000-0000-0000-0000-000000000201"),
            UUID.fromString("00000000-0000-0000-0000-000000000202"),
            UUID.fromString("00000000-0000-0000-0000-000000000203"),
            UUID.fromString("00000000-0000-0000-0000-000000000204"),
            UUID.fromString("00000000-0000-0000-0000-000000000205"));

    /** Each tick covers this share of the remaining distance, but at least {@link #MIN_STEP_METERS}. */
    static final double STEP_FRACTION = 0.2;
    static final double MIN_STEP_METERS = 50;

    private final JdbcTemplate jdbc;
    private final OfferService offers;
    private final RideService rides;
    private final DriverAvailabilityService availability;
    private final SimpUserRegistry wsUsers;
    private final long acceptDelayMs;
    private final long startDelayMs;

    public DriverSimulator(JdbcTemplate jdbc, OfferService offers, RideService rides,
                           DriverAvailabilityService availability, SimpUserRegistry wsUsers,
                           @Value("${app.simulator.accept-delay-ms:3000}") long acceptDelayMs,
                           @Value("${app.simulator.start-delay-ms:2000}") long startDelayMs) {
        this.jdbc = jdbc;
        this.offers = offers;
        this.rides = rides;
        this.availability = availability;
        this.wsUsers = wsUsers;
        this.acceptDelayMs = acceptDelayMs;
        this.startDelayMs = startDelayMs;
        log.info("Driver simulator enabled for {} seeded drivers", SEEDED_DRIVERS.size());
    }

    @Scheduled(fixedDelayString = "${app.simulator.tick-ms:2000}", initialDelayString = "${app.simulator.tick-ms:2000}")
    public void tick() {
        acceptDueOffers();
        driveActiveRides();
    }

    /** True for a seeded driver with no live WebSocket session. */
    boolean isSimulated(UUID driverId) {
        return SEEDED_DRIVERS.contains(driverId) && wsUsers.getUser(driverId.toString()) == null;
    }

    private record DueOffer(UUID rideId, UUID driverId) {
    }

    private void acceptDueOffers() {
        List<DueOffer> due = jdbc.query("""
                SELECT ride_id, driver_id FROM ride_offers
                WHERE status = 'OFFERED' AND expires_at > now()
                  AND offered_at <= now() - make_interval(secs => ?)""",
                (rs, i) -> new DueOffer(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class)), acceptDelayMs / 1000.0);
        for (DueOffer offer : due) {
            if (isSimulated(offer.driverId())) {
                safely(offer.rideId(), "accept", () -> offers.accept(offer.rideId(), offer.driverId()));
            }
        }
    }

    private record ActiveRide(UUID rideId, UUID driverId, String status, String pin, double lat, double lng,
                              double pickupLat, double pickupLng, double dropoffLat, double dropoffLng,
                              boolean readyToStart) {
    }

    private void driveActiveRides() {
        List<ActiveRide> active = jdbc.query("""
                SELECT r.id, r.driver_id, r.status, r.pin, d.current_lat, d.current_lng,
                       p.lat AS p_lat, p.lng AS p_lng, x.lat AS x_lat, x.lng AS x_lng,
                       (r.arrived_at <= now() - make_interval(secs => ?)) AS ready
                FROM rides r
                JOIN driver_profiles d ON d.user_id = r.driver_id
                JOIN hubs p ON p.id = r.pickup_hub_id
                JOIN hubs x ON x.id = r.dropoff_hub_id
                WHERE r.status IN ('ACCEPTED', 'ARRIVED', 'IN_PROGRESS')
                  AND d.current_lat IS NOT NULL AND d.current_lng IS NOT NULL""",
                (rs, i) -> new ActiveRide(rs.getObject("id", UUID.class), rs.getObject("driver_id", UUID.class),
                        rs.getString("status"), rs.getString("pin"), rs.getDouble("current_lat"),
                        rs.getDouble("current_lng"), rs.getDouble("p_lat"), rs.getDouble("p_lng"),
                        rs.getDouble("x_lat"), rs.getDouble("x_lng"), rs.getBoolean("ready")),
                startDelayMs / 1000.0);
        for (ActiveRide ride : active) {
            if (!isSimulated(ride.driverId())) {
                continue;
            }
            switch (ride.status()) {
                case "ACCEPTED" -> safely(ride.rideId(), "drive to pickup", () -> {
                    if (driveToward(ride, ride.pickupLat(), ride.pickupLng())) {
                        rides.arrived(ride.rideId(), ride.driverId());
                    }
                });
                case "ARRIVED" -> {
                    if (ride.readyToStart()) {
                        safely(ride.rideId(), "start", () -> rides.start(ride.rideId(), ride.driverId(), ride.pin()));
                    }
                }
                case "IN_PROGRESS" -> safely(ride.rideId(), "drive to dropoff", () -> {
                    if (driveToward(ride, ride.dropoffLat(), ride.dropoffLng())) {
                        rides.complete(ride.rideId(), ride.driverId());
                    }
                });
                default -> {
                }
            }
        }
    }

    /** Moves the driver one step toward the target via the normal location endpoint logic. True once there. */
    private boolean driveToward(ActiveRide ride, double targetLat, double targetLng) {
        double[] next = step(ride.lat(), ride.lng(), targetLat, targetLng);
        availability.updateLocation(ride.driverId(), next[0], next[1]);
        return next[0] == targetLat && next[1] == targetLng;
    }

    /** One tick of movement: a share of the remaining distance, snapping onto the target when close. */
    static double[] step(double lat, double lng, double targetLat, double targetLng) {
        double remaining = Haversine.meters(lat, lng, targetLat, targetLng);
        double stepMeters = Math.max(MIN_STEP_METERS, remaining * STEP_FRACTION);
        if (remaining <= stepMeters) {
            return new double[]{targetLat, targetLng};
        }
        double t = stepMeters / remaining;
        return new double[]{lat + (targetLat - lat) * t, lng + (targetLng - lng) * t};
    }

    private static void safely(UUID rideId, String action, Runnable work) {
        try {
            work.run();
        } catch (RuntimeException e) {
            // e.g. the rider cancelled between the read and the action; the next tick sees the new state
            log.info("Simulator skipped {} for ride {}: {}", action, rideId, e.getMessage());
        }
    }
}
