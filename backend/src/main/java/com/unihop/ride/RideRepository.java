package com.unihop.ride;

import com.unihop.common.enums.RideStatus;
import com.unihop.pricing.FareBreakdown;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Dev owns {@code rides}. Plain JDBC, like the rest of the backend. */
@Repository
@RequiredArgsConstructor
public class RideRepository {

    static final String ACTIVE_STATUSES = "('REQUESTED','ACCEPTED','ARRIVED','IN_PROGRESS')";

    private static final RowMapper<RideRow> MAPPER = RideRepository::map;

    private final JdbcTemplate jdbc;

    void insert(UUID id, UUID riderId, UUID pickupHubId, UUID dropoffHubId, FareBreakdown fare,
                String shareToken, String promoCode, Instant scheduledFor) {
        jdbc.update("""
                INSERT INTO rides (id, rider_id, pickup_hub_id, dropoff_hub_id, status, fare_total, platform_fee,
                                   base_fare, driver_payout, platform_margin, share_token, promo_code, scheduled_for)
                VALUES (?, ?, ?, ?, 'REQUESTED', ?, ?, ?, ?, ?, ?, ?, ?)""",
                id, riderId, pickupHubId, dropoffHubId, fare.total(), fare.platformFee(), fare.baseFare(),
                fare.driverPayout(), fare.platformMargin(), shareToken, promoCode,
                scheduledFor == null ? null : java.sql.Timestamp.from(scheduledFor));
    }

    public Optional<RideRow> find(UUID id) {
        return jdbc.query("SELECT * FROM rides WHERE id = ?", MAPPER, id).stream().findFirst();
    }

    /** Row-locks the ride for the rest of the transaction. */
    public Optional<RideRow> findForUpdate(UUID id) {
        return jdbc.query("SELECT * FROM rides WHERE id = ? FOR UPDATE", MAPPER, id).stream().findFirst();
    }

    /** REQUESTED -> NO_DRIVERS (contract section 10). Caller holds the row lock and has checked the transition. */
    public void markNoDrivers(UUID id) {
        jdbc.update("""
                UPDATE rides SET status = 'NO_DRIVERS', cancelled_by = 'SYSTEM', cancel_reason = 'No drivers available',
                                 cancelled_at = now()
                WHERE id = ?""", id);
    }

    /** The user's non-terminal ride as rider or driver, newest first. */
    public Optional<RideRow> findActiveFor(UUID userId) {
        return jdbc.query("SELECT * FROM rides WHERE (rider_id = ? OR driver_id = ?) AND status IN " + ACTIVE_STATUSES
                + " ORDER BY requested_at DESC LIMIT 1", MAPPER, userId, userId).stream().findFirst();
    }

    /** Serializes ride requests per user so two concurrent requests cannot both pass the active-ride check. */
    boolean lockUser(UUID userId) {
        List<Object> rows = jdbc.query("SELECT id FROM users WHERE id = ? FOR UPDATE", (rs, i) -> rs.getObject(1), userId);
        return !rows.isEmpty();
    }

    private static RideRow map(ResultSet rs, int row) throws SQLException {
        return new RideRow(
                rs.getObject("id", UUID.class),
                rs.getObject("rider_id", UUID.class),
                rs.getObject("driver_id", UUID.class),
                rs.getObject("pickup_hub_id", UUID.class),
                rs.getObject("dropoff_hub_id", UUID.class),
                RideStatus.valueOf(rs.getString("status")),
                new FareBreakdown(rs.getBigDecimal("fare_total"), rs.getBigDecimal("platform_fee"),
                        rs.getBigDecimal("base_fare"), rs.getBigDecimal("driver_payout"),
                        rs.getBigDecimal("platform_margin")),
                rs.getString("pin"),
                rs.getString("share_token"),
                instant(rs, "requested_at"),
                instant(rs, "accepted_at"),
                instant(rs, "arrived_at"),
                instant(rs, "started_at"),
                instant(rs, "completed_at"),
                instant(rs, "cancelled_at"),
                rs.getString("cancel_reason"),
                rs.getString("cancelled_by"));
    }

    static Instant instant(ResultSet rs, String column) throws SQLException {
        OffsetDateTime t = rs.getObject(column, OffsetDateTime.class);
        return t == null ? null : t.toInstant();
    }
}
