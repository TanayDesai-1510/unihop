package com.unihop.matching;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Dev owns {@code ride_offers}. A "live" offer is OFFERED and not yet past {@code expires_at}. */
@Repository
@RequiredArgsConstructor
public class OfferRepository {

    public static final int OFFER_SECONDS = 15;

    private final JdbcTemplate jdbc;

    /** A driver that could take a ride: APPROVED, online, located. */
    public record Candidate(UUID driverId, double lat, double lng) {
    }

    /** Overdue OFFERED offer flipped to EXPIRED by the sweeper. */
    public record Expired(UUID offerId, UUID rideId, UUID driverId) {
    }

    public record Inserted(UUID offerId, Instant expiresAt) {
    }

    /** Revoked offer: the driver to notify. */
    public record Revoked(UUID offerId, UUID driverId) {
    }

    /**
     * APPROVED, online drivers with a location, no active ride, no live offer, never offered this ride before
     * (contract section 10), excluding the rider.
     */
    List<Candidate> candidates(UUID rideId, UUID riderId) {
        return jdbc.query("""
                SELECT d.user_id, d.current_lat, d.current_lng FROM driver_profiles d
                WHERE d.status = 'APPROVED' AND d.is_online
                  AND d.current_lat IS NOT NULL AND d.current_lng IS NOT NULL
                  AND d.user_id <> ?
                  AND NOT EXISTS (SELECT 1 FROM rides r WHERE r.driver_id = d.user_id
                                  AND r.status IN ('REQUESTED','ACCEPTED','ARRIVED','IN_PROGRESS'))
                  AND NOT EXISTS (SELECT 1 FROM ride_offers o WHERE o.driver_id = d.user_id
                                  AND o.status = 'OFFERED' AND o.expires_at > now())
                  AND NOT EXISTS (SELECT 1 FROM ride_offers o WHERE o.driver_id = d.user_id AND o.ride_id = ?)""",
                (rs, i) -> new Candidate(rs.getObject("user_id", UUID.class), rs.getDouble("current_lat"),
                        rs.getDouble("current_lng")), riderId, rideId);
    }

    /**
     * Locks the driver's profile row, then re-checks availability so two rides dispatching at once can't both
     * offer to the same driver. Returns false if the driver was taken meanwhile.
     */
    boolean lockIfStillAvailable(UUID driverId) {
        jdbc.query("SELECT 1 FROM driver_profiles WHERE user_id = ? FOR UPDATE", (rs, i) -> 1, driverId);
        Integer busy = jdbc.queryForObject("""
                SELECT count(*) FROM driver_profiles d WHERE d.user_id = ? AND (NOT d.is_online
                   OR EXISTS (SELECT 1 FROM rides r WHERE r.driver_id = d.user_id
                              AND r.status IN ('REQUESTED','ACCEPTED','ARRIVED','IN_PROGRESS'))
                   OR EXISTS (SELECT 1 FROM ride_offers o WHERE o.driver_id = d.user_id
                              AND o.status = 'OFFERED' AND o.expires_at > now()))""", Integer.class, driverId);
        return busy != null && busy == 0;
    }

    boolean hasLiveOffer(UUID rideId) {
        Integer n = jdbc.queryForObject("""
                SELECT count(*) FROM ride_offers WHERE ride_id = ? AND status = 'OFFERED' AND expires_at > now()""",
                Integer.class, rideId);
        return n != null && n > 0;
    }

    Inserted insert(UUID rideId, UUID driverId) {
        UUID id = UUID.randomUUID();
        OffsetDateTime expires = jdbc.queryForObject("""
                INSERT INTO ride_offers (id, ride_id, driver_id, status, offered_at, expires_at)
                VALUES (?, ?, ?, 'OFFERED', now(), now() + make_interval(secs => ?))
                RETURNING expires_at""", OffsetDateTime.class, id, rideId, driverId, OFFER_SECONDS);
        return new Inserted(id, expires.toInstant());
    }

    /** Atomically expires every overdue OFFERED offer; the row locks make concurrent sweeps safe. */
    List<Expired> expireDue() {
        return jdbc.query("""
                UPDATE ride_offers SET status = 'EXPIRED'
                WHERE status = 'OFFERED' AND expires_at <= now()
                RETURNING id, ride_id, driver_id""", (rs, i) -> new Expired(rs.getObject("id", UUID.class),
                rs.getObject("ride_id", UUID.class), rs.getObject("driver_id", UUID.class)));
    }

    /** Expires the ride's OFFERED offer (rider cancelled), stamping responded_at. */
    List<Revoked> revoke(UUID rideId) {
        return jdbc.query("""
                UPDATE ride_offers SET status = 'EXPIRED', responded_at = now()
                WHERE ride_id = ? AND status = 'OFFERED'
                RETURNING id, driver_id""", (rs, i) -> new Revoked(rs.getObject("id", UUID.class),
                rs.getObject("driver_id", UUID.class)), rideId);
    }
}
