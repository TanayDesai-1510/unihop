package com.unihop.rating;

import com.unihop.common.ApiException;
import com.unihop.common.enums.RideStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class RatingService {
    private final JdbcTemplate jdbc;

    public RatingService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public void rate(UUID rideId, UUID raterId, int stars, String comment) {
        List<RateableRide> rows = jdbc.query("""
                SELECT rider_id, driver_id, status
                FROM rides
                WHERE id = ?
                FOR UPDATE
                """, (rs, row) -> new RateableRide(
                rs.getObject("rider_id", UUID.class),
                rs.getObject("driver_id", UUID.class),
                RideStatus.valueOf(rs.getString("status"))), rideId);
        if (rows.isEmpty()) {
            throw ApiException.notFound("NOT_FOUND", "Ride not found");
        }

        RateableRide ride = rows.getFirst();
        UUID rateeId;
        if (raterId.equals(ride.riderId())) {
            rateeId = ride.driverId();
        } else if (raterId.equals(ride.driverId())) {
            rateeId = ride.riderId();
        } else {
            throw ApiException.forbidden("Not a participant in this ride");
        }
        if (ride.status() != RideStatus.COMPLETED || rateeId == null) {
            throw ApiException.forbidden("Only participants in a completed ride can rate each other");
        }

        Boolean alreadyRated = jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM ratings WHERE ride_id = ? AND rater_id = ?)
                """, Boolean.class, rideId, raterId);
        if (Boolean.TRUE.equals(alreadyRated)) {
            throw ApiException.conflict("ALREADY_RATED", "You already rated this ride");
        }

        jdbc.update("""
                INSERT INTO ratings (id, ride_id, rater_id, ratee_id, stars, comment)
                VALUES (?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), rideId, raterId, rateeId, stars, normalizeComment(comment));
        jdbc.update("""
                UPDATE users
                SET rating_avg = round(((rating_avg * rating_count) + ?) / (rating_count + 1), 2),
                    rating_count = rating_count + 1
                WHERE id = ?
                """, stars, rateeId);
    }

    private static String normalizeComment(String comment) {
        return comment == null || comment.isBlank() ? null : comment.trim();
    }

    private record RateableRide(UUID riderId, UUID driverId, RideStatus status) {
    }
}
